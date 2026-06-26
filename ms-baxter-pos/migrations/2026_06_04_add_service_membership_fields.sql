-- Tambah kolom untuk membership package ke tabel services yang sudah ada.
-- Kolom ini hanya relevan untuk baris dengan category='membership'.
ALTER TABLE services ADD COLUMN IF NOT EXISTS vehicle_type VARCHAR(20)  NOT NULL DEFAULT '';
ALTER TABLE services ADD COLUMN IF NOT EXISTS features     TEXT         NOT NULL DEFAULT '[]';
ALTER TABLE services ADD COLUMN IF NOT EXISTS is_popular   BOOLEAN      NOT NULL DEFAULT FALSE;

-- Midtrans fields pada tabel transactions & transaction_items
ALTER TABLE transactions     ADD COLUMN IF NOT EXISTS tx_type          VARCHAR(50) NOT NULL DEFAULT 'service';
ALTER TABLE transactions     ADD COLUMN IF NOT EXISTS reference_id     BIGINT;
ALTER TABLE transactions     ADD COLUMN IF NOT EXISTS snap_token       TEXT;
ALTER TABLE transactions     ADD COLUMN IF NOT EXISTS raw_notification TEXT;
ALTER TABLE transaction_items ADD COLUMN IF NOT EXISTS name            VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE memberships      ADD COLUMN IF NOT EXISTS package_id       BIGINT;

CREATE INDEX IF NOT EXISTS idx_services_vehicle_type    ON services     (vehicle_type) WHERE vehicle_type != '';
CREATE INDEX IF NOT EXISTS idx_transactions_tx_type     ON transactions  (tx_type);
CREATE INDEX IF NOT EXISTS idx_memberships_package_id   ON memberships   (package_id);
