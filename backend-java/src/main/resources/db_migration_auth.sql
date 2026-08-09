-- Migration Script to update 'users' table to support Supabase Auth and monetization
CREATE TABLE IF NOT EXISTS public.users (
    id VARCHAR(255) PRIMARY KEY,
    supabase_user_id VARCHAR(255) UNIQUE,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255),
    avatar_url VARCHAR(255),
    created_at TIMESTAMP,
    last_login TIMESTAMP,
    plan_type VARCHAR(50) DEFAULT 'FREE',
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    username VARCHAR(255),
    password_hash VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE
);

-- Index for fast lookup by Supabase user id
CREATE INDEX IF NOT EXISTS idx_users_supabase_user_id ON public.users(supabase_user_id);
