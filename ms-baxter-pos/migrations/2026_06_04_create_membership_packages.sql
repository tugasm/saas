-- Rollback: hapus tabel membership_packages yang dibuat sebelumnya (salah desain).
-- Paket membership sudah ada di tabel services dengan category='membership'.
DROP TABLE IF EXISTS membership_packages;
