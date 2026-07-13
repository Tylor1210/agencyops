-- Agency Ops Database Schema
-- Compatible with PostgreSQL and (via db.js adapter) SQLite

-- 1. Users / Platform Operators
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(50) DEFAULT 'CREATOR' -- 'ADMIN', 'CREATOR'
);

-- 2. Parent Client Agencies
CREATE TABLE IF NOT EXISTS agencies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(255) NOT NULL UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Service Requests (formerly Agency Bundles)
CREATE TABLE IF NOT EXISTS service_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agency_id INTEGER NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    service_name VARCHAR(255) NOT NULL, -- e.g. "Weekly Profile Events Update", "Menu Specials Update"
    status VARCHAR(50) DEFAULT 'UNASSIGNED', -- 'UNASSIGNED', 'ASSIGNED', 'PAUSED'
    assigned_creator_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    preferred_execution_day VARCHAR(50),       -- e.g. 'FRIDAY'
    preferred_execution_time TEXT,              -- e.g. '17:00'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. Sub-Profiles / Talent under Service Requests
CREATE TABLE IF NOT EXISTS agency_sub_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_request_id INTEGER NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
    profile_name VARCHAR(255) NOT NULL,
    internal_cms_edit_url TEXT NOT NULL
);

-- 5. Support Routine / Pipeline Rules (Execution Blueprint)
CREATE TABLE IF NOT EXISTS routine_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_request_id INTEGER NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
    pipeline_type VARCHAR(50) NOT NULL,        -- 'INTERVAL_SCHEDULED', 'EVENT_DRIVEN'
    source_url TEXT,                            -- Client events page / data source
    execution_instructions TEXT,                -- Markdown checklist for the creator
    cron_interval_expression VARCHAR(100)       -- e.g. '0 8 * * 5' for Friday 8AM
);

-- 6. Active Task Queue / Execution Ledger
CREATE TABLE IF NOT EXISTS agency_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_request_id INTEGER NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
    assigned_to_creator_id INTEGER REFERENCES users(id),
    status VARCHAR(50) DEFAULT 'PENDING', -- 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'PAUSED'
    scheduled_for_timestamp DATETIME NOT NULL,
    started_at DATETIME,
    completed_at DATETIME
);

-- 7. Agency Asset Library (shared URLs, image references, reusable resources)
--    agency_id = NULL means globally shared across all agencies
--    agency_id = X    means scoped to that specific agency
CREATE TABLE IF NOT EXISTS agency_assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agency_id INTEGER REFERENCES agencies(id) ON DELETE CASCADE,
    added_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    asset_type VARCHAR(50) NOT NULL DEFAULT 'LINK', -- 'LINK', 'IMAGE'
    label VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    category VARCHAR(100) DEFAULT 'GENERAL', -- 'SPOTIFY','NEWS','SPECIALS','CMS','IMAGE','GENERAL'
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 8. Agency Chat/Text Logs (copy-pasted raw client chat briefings)
CREATE TABLE IF NOT EXISTS agency_chat_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agency_id INTEGER NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    added_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    sender_name VARCHAR(255) NOT NULL, -- e.g. "Jordan Reyes", "Client Team"
    message_content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
