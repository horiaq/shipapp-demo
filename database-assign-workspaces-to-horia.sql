-- ============================================================================
-- Assign Existing Workspaces to Horia's Account
-- Date: November 26, 2025
-- Purpose: Link all existing workspaces to horia@wiresells.com
-- ============================================================================

-- Show current state
\echo '=== BEFORE MIGRATION ==='
\echo ''
\echo 'Workspaces:'
SELECT workspace_id, workspace_name, store_name FROM workspaces WHERE workspace_id IN (1, 2, 4) ORDER BY workspace_id;

\echo ''
\echo 'User:'
SELECT user_id, email, first_name, last_name FROM users WHERE email = 'horia@wiresells.com';

\echo ''
\echo 'Current workspace access:'
SELECT uw.user_id, u.email, uw.workspace_id, w.workspace_name, uw.role 
FROM user_workspaces uw
JOIN users u ON u.user_id = uw.user_id
JOIN workspaces w ON w.workspace_id = uw.workspace_id
WHERE uw.user_id = 3
ORDER BY uw.workspace_id;

-- ============================================================================
-- ASSIGN WORKSPACES
-- ============================================================================

\echo ''
\echo '=== ASSIGNING WORKSPACES TO HORIA ==='
\echo ''

-- Link Horia to workspace 1 (Clo Skin)
INSERT INTO user_workspaces (user_id, workspace_id, role)
VALUES (3, 1, 'admin')
ON CONFLICT (user_id, workspace_id) DO NOTHING;

-- Link Horia to workspace 2 (InBreath)
INSERT INTO user_workspaces (user_id, workspace_id, role)
VALUES (3, 2, 'admin')
ON CONFLICT (user_id, workspace_id) DO NOTHING;

-- Link Horia to workspace 4 (Clo Skin PL)
INSERT INTO user_workspaces (user_id, workspace_id, role)
VALUES (3, 4, 'admin')
ON CONFLICT (user_id, workspace_id) DO NOTHING;

\echo 'Workspaces assigned!'

-- ============================================================================
-- VERIFICATION
-- ============================================================================

\echo ''
\echo '=== AFTER MIGRATION ==='
\echo ''
\echo 'Horia now has access to:'
SELECT 
  w.workspace_id,
  w.workspace_name,
  w.store_name,
  uw.role,
  (SELECT COUNT(*) FROM orders WHERE workspace_id = w.workspace_id) as order_count,
  (SELECT COUNT(*) FROM vouchers WHERE workspace_id = w.workspace_id) as voucher_count
FROM workspaces w
JOIN user_workspaces uw ON w.workspace_id = uw.workspace_id
WHERE uw.user_id = 3
ORDER BY w.workspace_id;

\echo ''
\echo '=== SUMMARY ==='
SELECT 
  'Total Workspaces' as metric,
  COUNT(DISTINCT uw.workspace_id)::text as value
FROM user_workspaces uw
WHERE uw.user_id = 3
UNION ALL
SELECT 
  'Total Orders',
  COUNT(*)::text
FROM orders o
WHERE o.workspace_id IN (
  SELECT workspace_id FROM user_workspaces WHERE user_id = 3
)
UNION ALL
SELECT 
  'Total Vouchers',
  COUNT(*)::text
FROM vouchers v
WHERE v.workspace_id IN (
  SELECT workspace_id FROM user_workspaces WHERE user_id = 3
);

\echo ''
\echo '✅ Migration complete! All workspaces assigned to horia@wiresells.com'
\echo ''

