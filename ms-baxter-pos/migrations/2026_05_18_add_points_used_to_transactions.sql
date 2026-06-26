-- Migration: add points_used to transactions
ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS points_used INTEGER NOT NULL DEFAULT 0;