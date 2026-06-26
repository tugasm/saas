-- Migration: add vehicle_id to transactions (for open bill membership activation)
ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE SET NULL;
