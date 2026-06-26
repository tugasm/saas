import axios from 'axios';
import Cookies from 'js-cookie';

// ============================================================================
// 1. INSTANCE UNTUK BACKEND EKSTERNAL (LEAPCELL)
// ============================================================================
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'https://ms-baxter-pos-tugasmeilyanto7522-bpwario0.leapcell.dev/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add token (External)
api.interceptors.request.use((config) => {
  const token = Cookies.get('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for error handling (External)
api.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        Cookies.remove('token');
        Cookies.remove('user');
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }
);

// ============================================================================
// 2. INSTANCE UNTUK LOCAL NEXT.JS API (/api)
// ============================================================================
const localApi = axios.create({
  baseURL: '/api', // Tetap mengarah ke folder lokal Next.js
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add token (Local) - Opsional jika API lokalmu butuh token
localApi.interceptors.request.use((config) => {
  const token = Cookies.get('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});


// ============================================================================
// 3. EXPORT SERVICES
// ============================================================================

export const auth = {
  login: (email: string, password: string) =>
      api.post('/admin/login', { email, password }),
};

export const services = {
  getAll: () => api.get('/admin/services'),
  create: (data: any) => api.post('/admin/services', data),
  update: (id: number, data: any) => api.put(`/admin/services/${id}`, data),
  delete: (id: number) => api.delete(`/admin/services/${id}`),
};

export const categories = {
  getAll: () => api.get('/admin/categories'),
  create: (data: any) => api.post('/admin/categories', data),
  update: (id: number, data: any) => api.put(`/admin/categories/${id}`, data),
  delete: (id: number) => api.delete(`/admin/categories/${id}`),
};

export const transactions = {
  getAll: (params?: any) => api.get('/admin/transactions', { params }),
  getOpen: () => api.get('/admin/transactions/open'),
  manualCheckout: (data: any) => api.post('/admin/transactions/manual', data),
  addItems: (id: number, data: { items: { service_id: number; quantity: number }[]; use_points?: boolean }) =>
      api.post(`/admin/transactions/${id}/items`, data),
  confirmPayment: (id: number, data?: { payment_method_id?: number }) =>
      api.post(`/admin/transactions/${id}/confirm`, data ?? {}),
  updateStatus: (id: number, status: string) =>
      api.patch(`/admin/transactions/${id}/status`, { status }),
  scanQR: (qrData: string) => api.post('/admin/transactions/scan-qr', { qr_data: qrData }),
};

export const members = {
  // ✅ Menggunakan localApi (otomatis ke /api/members/search di Next.js)
  search: (type: 'name' | 'plate' | 'email' | 'user_id', query: string) =>
      localApi.get('/members/search', {
        params: { type, query }
      }),
  // Tetap pakai `api` karena mengarah ke /admin (backend)
  autocompleteEmail: (q: string) =>
      api.get('/admin/users/autocomplete', { params: { q } }),
};

export const memberships = {
  getAll: (params?: any) => api.get('/admin/memberships', { params }),
  applyForUser: (data: { user_id: number; vehicle_id: number; payment_method_id: number }) =>
      api.post('/admin/membership/apply', data),
  renew: (data: { membership_id: number; payment_method_id: number }) =>
      api.post('/admin/membership/renew', data),
};

export const vehicles = {
  getAll: (params?: any) => api.get('/admin/vehicles', { params }),
  create: (data: any) => api.post('/admin/vehicles', data),
};

export const users = {
  getAll: (params?: any) => api.get('/admin/users', { params }),
  getMenus: () => api.get('/user/menus'),
  create: (data: any) => api.post('/admin/users', data),
  update: (id: number, data: any) => api.put(`/admin/users/${id}`, data),
  delete: (id: number) => api.delete(`/admin/users/${id}`),
};

export const rbac = {
  getRoles: () => api.get('/admin/rbac/roles'),
  updateRole: (data: { role: string; menus: string[] }) =>
      api.post('/admin/rbac/roles', data),
};

export const reports = {
  monthly: (params?: any) => api.get('/admin/reports/monthly', { params }),
  revenue: (params?: any) => api.get('/admin/reports/revenue', { params }),
  transactions: (params?: any) => api.get('/admin/reports/transaction', { params }),
  analytics: () => api.get('/admin/reports/analytics'),
  export: (params?: any) =>
      api.get('/admin/reports/export', { params, responseType: 'blob' }),
};

export const ledger = {
  getAll: (params?: any) => api.get('/admin/ledger', { params }),
  create: (data: any) => api.post('/admin/ledger', data),
};

export const cashflow = {
  getAll: (params?: any) => api.get('/admin/cashflow', { params }),
  cashIn: (data: any) => api.post('/admin/cashflow/in', data),
  cashOut: (data: any) => api.post('/admin/cashflow/out', data),
};

export const shifts = {
  getAll: (params?: any) => api.get('/admin/shifts', { params }),
  current: () => api.get('/admin/shifts/current'),
  open: (data: { opening_balance: number; opening_note?: string }) =>
      api.post('/admin/shifts/open', data),
  close: (data: { closing_balance: number; closing_note?: string }) =>
      api.post('/admin/shifts/close', data),
  report: (id: number | string) => api.get(`/admin/shifts/${id}/report`),
  rangeReport: (params?: any) => api.get('/admin/shifts/report', { params }),
};

export const logs = {
  getAll: (params?: any) => api.get('/admin/logs', { params }),
};

export const config = {
  getPoints: () => api.get('/admin/config/points'),
  updatePoints: (data: any) => api.put('/admin/config/points', data),
};

export const employees = {
  getAll: (params?: any) => api.get('/admin/employees', { params }),
  create: (data: any) => api.post('/admin/employees', data),
  update: (id: number, data: any) => api.put(`/admin/employees/${id}`, data),
  delete: (id: number) => api.delete(`/admin/employees/${id}`),
};

export const attendance = {
  getAll: (params?: any) => api.get('/admin/attendance', { params }),
  manual: (data: any) => api.post('/admin/attendance/manual', data),
};

export const loans = {
  getAll: (params?: any) => api.get('/admin/loans', { params }),
  create: (data: any) => api.post('/admin/loans', data),
};

export const payroll = {
  getPreview: (params?: any) => api.get('/admin/payroll/preview', { params }),
  generate: (data: any) => api.post('/admin/payroll/generate', data),
  getHistory: (params?: any) => api.get('/admin/payroll/history', { params }),
};

// ============================================================================
// 4. LOCAL SERVICES (Khusus untuk route lokal Next.js)
// ============================================================================

export const payment = {
  // ✅ Menggunakan localApi (otomatis ke /api/payment di Next.js)
  process: (data: any) => localApi.post('/payment', data),
};

export default api;
