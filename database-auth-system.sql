-- ============================================================================
-- Authentication System Migration
-- Purpose: Add user authentication and workspace access control
-- Created: November 26, 2025
-- ============================================================================

-- ============================================================================
-- USERS TABLE
-- Stores user accounts with email/password authentication
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
  user_id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- Comments for documentation
COMMENT ON TABLE users IS 'User accounts for authentication';
COMMENT ON COLUMN users.user_id IS 'Unique user identifier';
COMMENT ON COLUMN users.email IS 'User email address (used for login)';
COMMENT ON COLUMN users.password_hash IS 'Bcrypt hashed password';
COMMENT ON COLUMN users.first_name IS 'User first name';
COMMENT ON COLUMN users.last_name IS 'User last name';
COMMENT ON COLUMN users.avatar_url IS 'URL to user avatar image';
COMMENT ON COLUMN users.is_active IS 'Whether the user account is active';
COMMENT ON COLUMN users.last_login IS 'Last successful login timestamp';
COMMENT ON COLUMN users.created_at IS 'Account creation timestamp';
COMMENT ON COLUMN users.updated_at IS 'Last account update timestamp';

-- ============================================================================
-- USER_WORKSPACES TABLE
-- Links users to workspaces they have access to (many-to-many)
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_workspaces (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(workspace_id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL DEFAULT 'admin',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_user_workspace UNIQUE(user_id, workspace_id)
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_user_workspaces_user ON user_workspaces(user_id);
CREATE INDEX IF NOT EXISTS idx_user_workspaces_workspace ON user_workspaces(workspace_id);
CREATE INDEX IF NOT EXISTS idx_user_workspaces_role ON user_workspaces(role);

-- Comments for documentation
COMMENT ON TABLE user_workspaces IS 'Links users to workspaces with role-based access';
COMMENT ON COLUMN user_workspaces.user_id IS 'Reference to user account';
COMMENT ON COLUMN user_workspaces.workspace_id IS 'Reference to workspace';
COMMENT ON COLUMN user_workspaces.role IS 'User role in workspace: admin, member, viewer';
COMMENT ON COLUMN user_workspaces.created_at IS 'When user was granted access';

-- ============================================================================
-- USER_SESSIONS TABLE
-- Tracks active user sessions with JWT tokens
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_sessions (
  session_id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  token VARCHAR(500) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON user_sessions(expires_at);

-- Comments for documentation
COMMENT ON TABLE user_sessions IS 'Active user sessions for authentication';
COMMENT ON COLUMN user_sessions.session_id IS 'Unique session identifier';
COMMENT ON COLUMN user_sessions.user_id IS 'Reference to user account';
COMMENT ON COLUMN user_sessions.token IS 'JWT token (unique)';
COMMENT ON COLUMN user_sessions.expires_at IS 'Session expiration timestamp';
COMMENT ON COLUMN user_sessions.created_at IS 'Session creation timestamp';
COMMENT ON COLUMN user_sessions.last_used_at IS 'Last time session was used';

-- ============================================================================
-- UPDATE WORKSPACES TABLE
-- Add auth_mode column for future Shopify OAuth support
-- ============================================================================

ALTER TABLE workspaces 
  ADD COLUMN IF NOT EXISTS auth_mode VARCHAR(20) DEFAULT 'demo';

-- Comment for documentation
COMMENT ON COLUMN workspaces.auth_mode IS 'Authentication mode: demo (email/password) or shopify (OAuth)';

-- ============================================================================
-- CLEANUP FUNCTION
-- Automatically delete expired sessions (can be called by cron job)
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM user_sessions WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_sessions IS 'Deletes expired sessions, returns count of deleted rows';

-- ============================================================================
-- TRIGGER FOR UPDATED_AT
-- Automatically update updated_at timestamp on user changes
-- ============================================================================

CREATE OR REPLACE FUNCTION update_user_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_timestamp
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_user_timestamp();

COMMENT ON FUNCTION update_user_timestamp IS 'Automatically updates updated_at timestamp';

-- ============================================================================
-- VERIFICATION QUERIES
-- Run these to verify the migration was successful
-- ============================================================================

-- Display table structures
\echo ''
\echo '=== USERS TABLE ==='
\d users

\echo ''
\echo '=== USER_WORKSPACES TABLE ==='
\d user_workspaces

\echo ''
\echo '=== USER_SESSIONS TABLE ==='
\d user_sessions

\echo ''
\echo '=== WORKSPACES TABLE (auth_mode column) ==='
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'workspaces' AND column_name = 'auth_mode';

-- Display indexes
\echo ''
\echo '=== INDEXES ==='
SELECT tablename, indexname 
FROM pg_indexes 
WHERE tablename IN ('users', 'user_workspaces', 'user_sessions')
ORDER BY tablename, indexname;

-- Count existing records
\echo ''
\echo '=== CURRENT DATA ==='
SELECT 'users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'user_workspaces', COUNT(*) FROM user_workspaces
UNION ALL
SELECT 'user_sessions', COUNT(*) FROM user_sessions;

\echo ''
\echo '✅ Migration complete!'
\echo ''
\echo 'Next steps:'
\echo '1. Create your first user via the register endpoint'
\echo '2. Or manually insert a test user with SQL'
\echo ''


