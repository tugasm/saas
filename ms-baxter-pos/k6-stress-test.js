import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// ============================================================
// KONFIGURASI - Sesuaikan sebelum menjalankan test
// ============================================================
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8083';
const ADMIN_EMAIL = __ENV.ADMIN_EMAIL || 'admin@carwash.com';
const ADMIN_PASSWORD = __ENV.ADMIN_PASSWORD || 'admin123';

// Custom Metrics
const errorRate = new Rate('error_rate');
const loginDuration = new Trend('login_duration', true);
const serviceListDuration = new Trend('service_list_duration', true);
const transactionDuration = new Trend('transaction_duration', true);
const reportDuration = new Trend('report_duration', true);
const checkoutDuration = new Trend('checkout_duration', true);
const totalRequests = new Counter('total_requests');

// ============================================================
// SKENARIO TEST
// ============================================================
export const options = {
  scenarios: {
    // Tahap 1: Smoke Test (sanity check)
    smoke: {
      executor: 'constant-vus',
      vus: 2,
      duration: '30s',
      startTime: '0s',
      tags: { test_type: 'smoke' },
    },

    // Tahap 2: Load Test (beban normal harian)
    load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 20 },   // Ramp up ke 20 user
        { duration: '3m', target: 20 },   // Bertahan di 20 user
        { duration: '1m', target: 0 },    // Ramp down
      ],
      startTime: '35s',
      tags: { test_type: 'load' },
    },

    // Tahap 3: Stress Test (beban puncak)
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 50 },   // Ramp up ke 50 user
        { duration: '2m', target: 50 },   // Bertahan di 50 user
        { duration: '1m', target: 100 },  // Naikkan ke 100 user
        { duration: '2m', target: 100 },  // Bertahan di 100 user
        { duration: '1m', target: 0 },    // Ramp down
      ],
      startTime: '6m',
      tags: { test_type: 'stress' },
    },

    // Tahap 4: Spike Test (lonjakan tiba-tiba)
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 150 }, // Lonjakan mendadak 150 user
        { duration: '1m', target: 150 },  // Bertahan
        { duration: '10s', target: 0 },   // Drop mendadak
      ],
      startTime: '13m',
      tags: { test_type: 'spike' },
    },
  },

  thresholds: {
    http_req_duration: ['p(95)<2000'],     // 95% request harus < 2 detik
    http_req_failed: ['rate<0.05'],         // Error rate < 5%
    error_rate: ['rate<0.1'],               // Custom error rate < 10%
    login_duration: ['p(95)<3000'],         // Login harus < 3 detik
    service_list_duration: ['p(95)<1000'],  // List service harus < 1 detik
    transaction_duration: ['p(95)<2000'],   // Transaksi harus < 2 detik
    checkout_duration: ['p(95)<3000'],      // Checkout harus < 3 detik
  },
};

// ============================================================
// HELPER: Login dan dapatkan token
// ============================================================
function adminLogin() {
  const payload = JSON.stringify({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });

  const params = {
    headers: { 'Content-Type': 'application/json' },
    tags: { name: 'POST /api/admin/login' },
  };

  const start = Date.now();
  const res = http.post(`${BASE_URL}/api/admin/login`, payload, params);
  loginDuration.add(Date.now() - start);
  totalRequests.add(1);

  const success = check(res, {
    'login: status 200': (r) => r.status === 200,
    'login: has token': (r) => {
      try {
        return JSON.parse(r.body).token !== undefined;
      } catch {
        return false;
      }
    },
  });

  errorRate.add(!success);

  if (res.status === 200) {
    try {
      return JSON.parse(res.body).token;
    } catch {
      return null;
    }
  }
  return null;
}

function authHeaders(token) {
  return {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  };
}

// ============================================================
// SETUP: Login sekali, token di-share ke semua VU
// ============================================================
export function setup() {
  const token = adminLogin();
  if (!token) {
    throw new Error('Setup failed: cannot login. Pastikan server berjalan dan kredensial benar.');
  }
  return { token, createdAt: Date.now() };
}

// Token refresh interval: 7 jam (token expire 8 jam, refresh sebelum habis)
const TOKEN_REFRESH_MS = 7 * 60 * 60 * 1000;

// Per-VU token cache
let vuToken = null;
let vuTokenTime = 0;

function getValidToken(setupData) {
  const now = Date.now();
  // Jika VU belum punya token atau sudah mendekati expire, refresh
  if (!vuToken || (now - vuTokenTime) > TOKEN_REFRESH_MS) {
    const freshToken = adminLogin();
    if (freshToken) {
      vuToken = freshToken;
      vuTokenTime = now;
      return vuToken;
    }
    // Fallback ke setup token jika refresh gagal
    return setupData.token;
  }
  return vuToken;
}

// ============================================================
// SKENARIO UTAMA
// ============================================================
export default function (data) {
  const token = getValidToken(data);
  const headers = authHeaders(token);

  // 2. List Services (endpoint publik - paling sering diakses)
  group('Public - List Services', () => {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/api/services`, {
      ...headers,
      tags: { name: 'GET /api/services' },
    });
    serviceListDuration.add(Date.now() - start);
    totalRequests.add(1);

    const success = check(res, {
      'services: status 200': (r) => r.status === 200,
      'services: is array': (r) => {
        try {
          return Array.isArray(JSON.parse(r.body));
        } catch {
          return false;
        }
      },
    });
    errorRate.add(!success);
  });

  sleep(0.5);

  // 3. Get Transactions (admin dashboard)
  group('Admin - Get Transactions', () => {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/api/admin/transactions`, {
      ...headers,
      tags: { name: 'GET /api/admin/transactions' },
    });
    transactionDuration.add(Date.now() - start);
    totalRequests.add(1);

    const success = check(res, {
      'transactions: status 200': (r) => r.status === 200,
    });
    errorRate.add(!success);
  });

  sleep(0.5);

  // 4. Manual Checkout (POS - operasi paling kritis)
  group('Admin - Manual Checkout', () => {
    const payload = JSON.stringify({
      customer_name: `StressTest_User_${__VU}_${__ITER}`,
      items: [
        { service_id: 1, quantity: 1 },
      ],
      payment_method_id: 1,
      notes: `K6 stress test VU:${__VU} ITER:${__ITER}`,
    });

    const start = Date.now();
    const res = http.post(`${BASE_URL}/api/admin/transactions/manual`, payload, {
      ...headers,
      tags: { name: 'POST /api/admin/transactions/manual' },
    });
    checkoutDuration.add(Date.now() - start);
    totalRequests.add(1);

    const success = check(res, {
      'checkout: status 200': (r) => r.status === 200,
      'checkout: has transaction_code': (r) => {
        try {
          return JSON.parse(r.body).transaction_code !== undefined;
        } catch {
          return false;
        }
      },
    });
    errorRate.add(!success);
  });

  sleep(0.5);

  // 5. Monthly Report (endpoint berat - banyak query)
  group('Admin - Monthly Report', () => {
    const now = new Date();
    const start = Date.now();
    const res = http.get(
      `${BASE_URL}/api/admin/reports/monthly?year=${now.getFullYear()}&month=${now.getMonth() + 1}`,
      {
        ...headers,
        tags: { name: 'GET /api/admin/reports/monthly' },
      }
    );
    reportDuration.add(Date.now() - start);
    totalRequests.add(1);

    const success = check(res, {
      'report: status 200': (r) => r.status === 200,
    });
    errorRate.add(!success);
  });

  sleep(0.5);

  // 6. Revenue Chart
  group('Admin - Revenue Chart', () => {
    const res = http.get(
      `${BASE_URL}/api/admin/reports/revenue?year=${new Date().getFullYear()}`,
      {
        ...headers,
        tags: { name: 'GET /api/admin/reports/revenue' },
      }
    );
    totalRequests.add(1);

    const success = check(res, {
      'revenue chart: status 200': (r) => r.status === 200,
    });
    errorRate.add(!success);
  });

  sleep(0.5);

  // 7. Get Memberships
  group('Admin - Get Memberships', () => {
    const res = http.get(`${BASE_URL}/api/admin/memberships`, {
      ...headers,
      tags: { name: 'GET /api/admin/memberships' },
    });
    totalRequests.add(1);

    const success = check(res, {
      'memberships: status 200': (r) => r.status === 200,
    });
    errorRate.add(!success);
  });

  sleep(0.5);

  // 8. Cash Flow
  group('Admin - Cash Flow', () => {
    const res = http.get(`${BASE_URL}/api/admin/cashflow`, {
      ...headers,
      tags: { name: 'GET /api/admin/cashflow' },
    });
    totalRequests.add(1);

    const success = check(res, {
      'cashflow: status 200': (r) => r.status === 200,
    });
    errorRate.add(!success);
  });

  sleep(0.5);

  // 9. Analytics (endpoint berat - multiple raw SQL)
  group('Admin - Analytics', () => {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/api/admin/reports/analytics`, {
      ...headers,
      tags: { name: 'GET /api/admin/reports/analytics' },
    });
    reportDuration.add(Date.now() - start);
    totalRequests.add(1);

    const success = check(res, {
      'analytics: status 200': (r) => r.status === 200,
    });
    errorRate.add(!success);
  });

  sleep(1);
}

// ============================================================
// SUMMARY HANDLER - Output yang mudah dibaca
// ============================================================
export function handleSummary(data) {
  const metrics = data.metrics;

  function fmt(val) {
    if (val === undefined || val === null) return 'N/A';
    if (typeof val === 'number') return val.toFixed(2);
    return String(val);
  }

  function ms(val) {
    if (val === undefined || val === null) return 'N/A';
    return `${val.toFixed(0)} ms`;
  }

  const totalReqs = metrics.http_reqs ? metrics.http_reqs.values.count : 0;
  const totalDuration = metrics.iteration_duration
    ? metrics.iteration_duration.values['p(95)'] / 1000
    : 0;
  const avgDuration = metrics.http_req_duration
    ? metrics.http_req_duration.values.avg
    : 0;
  const p95Duration = metrics.http_req_duration
    ? metrics.http_req_duration.values['p(95)']
    : 0;
  const p99Duration = metrics.http_req_duration
    ? metrics.http_req_duration.values['p(99)']
    : 0;
  const maxDuration = metrics.http_req_duration
    ? metrics.http_req_duration.values.max
    : 0;
  const failRate = metrics.http_req_failed
    ? metrics.http_req_failed.values.rate * 100
    : 0;
  const reqPerSec = metrics.http_reqs
    ? metrics.http_reqs.values.rate
    : 0;

  // Custom metrics
  const loginP95 = metrics.login_duration
    ? metrics.login_duration.values['p(95)']
    : null;
  const serviceP95 = metrics.service_list_duration
    ? metrics.service_list_duration.values['p(95)']
    : null;
  const trxP95 = metrics.transaction_duration
    ? metrics.transaction_duration.values['p(95)']
    : null;
  const checkoutP95 = metrics.checkout_duration
    ? metrics.checkout_duration.values['p(95)']
    : null;
  const reportP95 = metrics.report_duration
    ? metrics.report_duration.values['p(95)']
    : null;

  const checksTotal = metrics.checks
    ? metrics.checks.values.passes + metrics.checks.values.fails
    : 0;
  const checksPassed = metrics.checks ? metrics.checks.values.passes : 0;
  const checksFailed = metrics.checks ? metrics.checks.values.fails : 0;

  const vusMax = metrics.vus_max ? metrics.vus_max.values.max : 0;

  // Hitung estimasi kapasitas
  const safeRPS = reqPerSec * (failRate < 5 ? 1 : 0.7);
  const estimatedUsersPerHour = Math.floor(safeRPS * 3600 / 9); // 9 requests per iteration

  const report = `
================================================================================
    LAPORAN STRESS TEST - ms-baxter-pos (Carwash POS System)
    Tanggal: ${new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
    Target: ${BASE_URL}
================================================================================

RINGKASAN EKSEKUTIF
--------------------
Total Request       : ${totalReqs.toLocaleString('id-ID')} request
Request per Detik   : ${fmt(reqPerSec)} req/s
User Bersamaan Max  : ${vusMax} user
Tingkat Error       : ${fmt(failRate)}%
Waktu Respons Rata2 : ${ms(avgDuration)}
Waktu Respons P95   : ${ms(p95Duration)}
Waktu Respons P99   : ${ms(p99Duration)}
Waktu Respons Max   : ${ms(maxDuration)}

VERIFIKASI FUNGSIONAL
---------------------
Total Pengecekan    : ${checksTotal}
Berhasil            : ${checksPassed} (${checksTotal > 0 ? fmt(checksPassed / checksTotal * 100) : 0}%)
Gagal               : ${checksFailed}

DETAIL PER ENDPOINT
--------------------
Login Admin          : P95 = ${ms(loginP95)}
List Services        : P95 = ${ms(serviceP95)}
Get Transactions     : P95 = ${ms(trxP95)}
Manual Checkout      : P95 = ${ms(checkoutP95)}
Reports & Analytics  : P95 = ${ms(reportP95)}

ESTIMASI KAPASITAS PRODUKSI
-----------------------------
Request per detik (aman)  : ~${fmt(safeRPS)} req/s
Estimasi user per jam     : ~${estimatedUsersPerHour.toLocaleString('id-ID')} user/jam
Estimasi transaksi/jam    : ~${Math.floor(safeRPS * 3600 / 9).toLocaleString('id-ID')} transaksi/jam

CATATAN:
- Estimasi berdasarkan 9 request per sesi user (login, browse, checkout, dst)
- Angka di atas adalah kapasitas SATU instance server
- Production capacity bisa ditingkatkan dengan load balancing

STATUS THRESHOLD
-----------------
HTTP Response Time (P95 < 2s) : ${p95Duration < 2000 ? 'LULUS' : 'GAGAL'} (${ms(p95Duration)})
Error Rate (< 5%)             : ${failRate < 5 ? 'LULUS' : 'GAGAL'} (${fmt(failRate)}%)
Login Time (P95 < 3s)         : ${loginP95 !== null && loginP95 < 3000 ? 'LULUS' : loginP95 === null ? 'N/A' : 'GAGAL'} (${ms(loginP95)})
Service List (P95 < 1s)       : ${serviceP95 !== null && serviceP95 < 1000 ? 'LULUS' : serviceP95 === null ? 'N/A' : 'GAGAL'} (${ms(serviceP95)})
Transaction (P95 < 2s)        : ${trxP95 !== null && trxP95 < 2000 ? 'LULUS' : trxP95 === null ? 'N/A' : 'GAGAL'} (${ms(trxP95)})
Checkout (P95 < 3s)           : ${checkoutP95 !== null && checkoutP95 < 3000 ? 'LULUS' : checkoutP95 === null ? 'N/A' : 'GAGAL'} (${ms(checkoutP95)})

================================================================================
`;

  // Juga simpan JSON untuk analisis lanjutan
  return {
    'stdout': report,
    'k6-results.json': JSON.stringify(data, null, 2),
  };
}
