-- Migration: add FCM device token column to users (mobile push)
-- Run on PostgreSQL

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS fcm_token TEXT;
