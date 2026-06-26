-- HRIS: Reimbursement & Overtime tables
-- AutoMigrate handles creation, but this file documents the schema.

CREATE TABLE IF NOT EXISTS reimbursements (
    id            BIGSERIAL PRIMARY KEY,
    user_id       BIGINT NOT NULL REFERENCES users(id),
    amount        NUMERIC(14,2) NOT NULL,
    category      VARCHAR(50) NOT NULL,        -- transport, meal, medical, other
    description   TEXT NOT NULL,
    evidence      TEXT,                         -- URL foto struk
    expense_date  DATE NOT NULL,
    status        VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, approved, rejected
    admin_notes   TEXT,
    approved_by   BIGINT REFERENCES users(id),
    approved_at   TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_reimbursements_user_id ON reimbursements(user_id);
CREATE INDEX IF NOT EXISTS idx_reimbursements_status  ON reimbursements(status);
CREATE INDEX IF NOT EXISTS idx_reimbursements_deleted ON reimbursements(deleted_at);

CREATE TABLE IF NOT EXISTS overtime_requests (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id),
    date        DATE NOT NULL,
    start_time  TIMESTAMPTZ NOT NULL,
    end_time    TIMESTAMPTZ NOT NULL,
    hours       NUMERIC(5,2) NOT NULL,
    reason      TEXT NOT NULL,
    status      VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, approved, rejected
    admin_notes TEXT,
    approved_by BIGINT REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_overtime_user_id ON overtime_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_overtime_status  ON overtime_requests(status);
CREATE INDEX IF NOT EXISTS idx_overtime_deleted ON overtime_requests(deleted_at);
