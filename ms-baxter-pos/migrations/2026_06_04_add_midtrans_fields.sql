-- Midtrans payment + membership package support
-- Aman dijalankan berulang (IF NOT EXISTS / ALTER TABLE ... ADD COLUMN IF NOT EXISTS)

-- transactions: tambah kolom untuk Midtrans & tipe transaksi
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS tx_type        VARCHAR(50) NOT NULL DEFAULT 'service';
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS reference_id   BIGINT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS snap_token     TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS raw_notification TEXT;

-- transaction_items: tambah kolom name untuk item non-service (mis. paket membership)
ALTER TABLE transaction_items ADD COLUMN IF NOT EXISTS name VARCHAR(255) NOT NULL DEFAULT '';

-- memberships: tambah relasi ke paket
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS package_id BIGINT;

-- Index untuk pencarian yang umum
CREATE INDEX IF NOT EXISTS idx_transactions_tx_type    ON transactions (tx_type);
CREATE INDEX IF NOT EXISTS idx_memberships_package_id  ON memberships  (package_id);
