-- Migration: add points redemption support
-- Run on PostgreSQL

ALTER TABLE services
    ADD COLUMN IF NOT EXISTS points_price INTEGER NOT NULL DEFAULT 0;

INSERT INTO payment_methods (name, type, is_active, created_at, updated_at)
SELECT 'Points', 'points', true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM payment_methods WHERE type = 'points');
