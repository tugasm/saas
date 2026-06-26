-- Migration: add profile fields (address, birth_place, birth_date, gender) to users
-- Run on PostgreSQL

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS address     TEXT        NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS birth_place VARCHAR(255) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS birth_date  DATE,
    ADD COLUMN IF NOT EXISTS gender      VARCHAR(10) NOT NULL DEFAULT '';

-- Optional: enforce gender values at DB level
ALTER TABLE users
    DROP CONSTRAINT IF EXISTS users_gender_check;
ALTER TABLE users
    ADD CONSTRAINT users_gender_check
    CHECK (gender IN ('', 'male', 'female'));
