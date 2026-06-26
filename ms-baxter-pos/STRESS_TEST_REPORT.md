# Stress Test Report

**Aplikasi:** Baxter POS - Carwash Management System
**Tanggal:** 12 April 2026
**Tools:** k6 by Grafana Labs (Industry Standard Load Testing)
**Target:** Production Server

---

## 1. Ringkasan Eksekutif

Stress test dilakukan untuk memvalidasi kemampuan server Baxter POS dalam menangani beban pengguna secara bersamaan (concurrent users). Pengujian mencakup 4 tahap dengan peningkatan beban bertahap hingga **150 pengguna simultan**, mensimulasikan kondisi normal hingga lonjakan ekstrem.

---

## 2. Skenario Pengujian

| Tahap | Skenario | Durasi | Jumlah User | Tujuan |
|:-----:|----------|:------:|:-----------:|--------|
| 1 | **Smoke Test** | 30 detik | 2 | Validasi sistem berjalan normal |
| 2 | **Load Test** | 5 menit | 20 | Simulasi beban operasional harian |
| 3 | **Stress Test** | 7 menit | 50 - 100 | Simulasi jam sibuk / hari puncak |
| 4 | **Spike Test** | 1,5 menit | 150 | Simulasi lonjakan mendadak (promo, event) |

**Total durasi pengujian:** ~15 menit berkesinambungan

---

## 3. Endpoint yang Diuji

Seluruh endpoint kritikal yang digunakan dalam operasional harian diuji:

| No | Endpoint | Fungsi | Prioritas |
|:--:|----------|--------|:---------:|
| 1 | Login Admin | Autentikasi pengguna dashboard | Tinggi |
| 2 | Daftar Layanan | Menampilkan menu service (publik) | Tinggi |
| 3 | Riwayat Transaksi | Data transaksi di dashboard | Tinggi |
| 4 | **Checkout / Kasir** | **Proses pembayaran POS** | **Kritis** |
| 5 | Laporan Bulanan | Report pendapatan per bulan | Sedang |
| 6 | Grafik Pendapatan | Chart revenue tahunan | Sedang |
| 7 | Daftar Membership | Data member terdaftar | Sedang |
| 8 | Arus Kas | Cash flow masuk/keluar | Sedang |
| 9 | Analitik Bisnis | Dashboard analitik (query berat) | Sedang |

**Setiap sesi pengguna menjalankan 9 request** secara berurutan, mensimulasikan alur kerja nyata kasir.

---

## 4. Kriteria Kelulusan (SLA)

| Metrik | Target | Keterangan |
|--------|:------:|------------|
| Waktu respons keseluruhan (P95) | < 2.000 ms | 95% request selesai dalam 2 detik |
| Tingkat error | < 5% | Maksimal 5 dari 100 request gagal |
| Waktu login (P95) | < 3.000 ms | Proses login admin |
| Daftar layanan (P95) | < 1.000 ms | Halaman paling sering diakses |
| Transaksi dashboard (P95) | < 2.000 ms | Pemuatan data transaksi |
| Checkout kasir (P95) | < 3.000 ms | Operasi pembayaran (paling kritis) |

> **P95** = 95 dari 100 request harus memenuhi target waktu di atas.

---

## 5. Cara Membaca Hasil

Setelah test dijalankan, output akan menampilkan:

```
================================================================================
    LAPORAN STRESS TEST - ms-baxter-pos (Carwash POS System)
================================================================================

RINGKASAN EKSEKUTIF
--------------------
Total Request       : 12.345 request
Request per Detik   : 15.23 req/s
User Bersamaan Max  : 150 user
Tingkat Error       : 0.50%           <-- Harus < 5%
Waktu Respons P95   : 850 ms          <-- Harus < 2.000 ms

STATUS THRESHOLD
-----------------
HTTP Response Time (P95 < 2s) : LULUS (850 ms)
Error Rate (< 5%)             : LULUS (0.50%)
Login Time (P95 < 3s)         : LULUS (320 ms)
...
================================================================================
```

**Interpretasi:**
- **LULUS** = Endpoint memenuhi standar performa
- **GAGAL** = Perlu optimasi lebih lanjut

---

## 6. Estimasi Kapasitas Produksi

Berdasarkan hasil pengujian, sistem mampu melayani:

| Metrik | Estimasi |
|--------|----------|
| Request per detik (aman) | Ditampilkan di hasil test |
| Estimasi user per jam | Dihitung otomatis dari throughput |
| Estimasi transaksi per jam | Dihitung otomatis dari throughput |

> **Catatan:**
> - Estimasi berdasarkan 9 request per sesi pengguna
> - Angka di atas untuk **1 instance server**
> - Kapasitas dapat ditingkatkan dengan load balancing (horizontal scaling)

---

## 7. Optimasi yang Sudah Diterapkan

Sebelum pengujian, beberapa optimasi telah dilakukan pada backend:

| Optimasi | Detail |
|----------|--------|
| Database Connection Pool | Max 50 koneksi, idle 10, lifetime 30 menit |
| Query Pagination | Endpoint transaksi dibatasi max 500 record per request |
| Logging Optimization | Menghapus debug logging yang tidak perlu di production |

---

## 8. Rekomendasi

1. **Jalankan test secara berkala** (setiap release baru) untuk mendeteksi regresi performa
2. **Monitor di production** menggunakan APM tools untuk memastikan hasil test sesuai kondisi nyata
3. **Horizontal scaling** dapat diterapkan jika jumlah cabang/outlet bertambah dan membutuhkan kapasitas lebih tinggi

---

## 9. Cara Menjalankan Test Ulang

```bash
# Jalankan terhadap server lokal
k6 run k6-stress-test.js

# Jalankan terhadap server production
k6 run -e BASE_URL=https://api-production.example.com k6-stress-test.js

# Jalankan dengan kredensial custom
k6 run -e BASE_URL=https://api.example.com \
       -e ADMIN_EMAIL=admin@carwash.com \
       -e ADMIN_PASSWORD=admin123 \
       k6-stress-test.js
```

---

*Report ini dihasilkan menggunakan k6 stress testing framework.*
*Detail teknis lengkap tersedia di file `k6-results.json` setelah test dijalankan.*
