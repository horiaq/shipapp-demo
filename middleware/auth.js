// ============================================================================
// Authentication Middleware
// Protect API endpoints and verify workspace access
// ============================================================================

const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

// Create database pool
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'geniki_orders',
  password: process.env.DB_PASSWORD || '',
  port: process.env.DB_PORT || 5432,
});

// ============================================================================
// AUTHENTICATE USER
// Verifies JWT token and loads user data
// ============================================================================

async function authenticateUser(req, res, next) {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        error: 'Authentication required. Please provide a valid token.' 
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'demo-secret-key');
    } catch (err) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid or expired token. Please login again.' 
      });
    }

    // Check session exists in database and is not expired
    const sessionResult = await pool.query(
      'SELECT * FROM user_sessions WHERE token = $1 AND expires_at > NOW()',
      [token]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(401).json({ 
        success: false, 
        error: 'Session expired. Please login again.' 
      });
    }

    // Get user from database
    const userResult = await pool.query(
      'SELECT user_id, email, first_name, last_name, is_active FROM users WHERE user_id = $1',
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ 
        success: false, 
        error: 'User not found. Please login again.' 
      });
    }

    const user = userResult.rows[0];

    // Check if user is active
    if (!user.is_active) {
      return res.status(401).json({ 
        success: false, 
        error: 'Account is disabled. Please contact support.' 
      });
    }

    // Update last_used_at for the session
    await pool.query(
      'UPDATE user_sessions SET last_used_at = NOW() WHERE token = $1',
      [token]
    );

    // Attach user to request object
    req.user = user;
    req.token = token;
    
    // Continue to next middleware
    next();

  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Authentication failed. Please try again.' 
    });
  }
}

// ============================================================================
// AUTHORIZE WORKSPACE
// Checks if user has access to the requested workspace
// ============================================================================

async function authorizeWorkspace(req, res, next) {
  try {
    // Extract workspaceId from various possible locations
    const workspaceId = parseInt(
      req.params.workspaceId ||  // /api/workspaces/:workspaceId/...
      req.params.id ||            // /api/workspaces/:id/...
      req.body.workspaceId ||     // POST body
      req.query.workspaceId ||    // Query string ?workspaceId=1
      req.headers['x-workspace-id'] // Custom header
    );

    if (!workspaceId || isNaN(workspaceId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Workspace ID is required. Please specify a workspace.' 
      });
    }

    // Check if user has access to this workspace
    const accessResult = await pool.query(
      `SELECT uw.*, w.workspace_name, w.is_active as workspace_active
       FROM user_workspaces uw
       JOIN workspaces w ON w.workspace_id = uw.workspace_id
       WHERE uw.user_id = $1 AND uw.workspace_id = $2`,
      [req.user.user_id, workspaceId]
    );

    if (accessResult.rows.length === 0) {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied. You do not have permission to access this workspace.' 
      });
    }

    const access = accessResult.rows[0];

    // Check if workspace is active
    if (!access.workspace_active) {
      return res.status(403).json({ 
        success: false, 
        error: 'This workspace is disabled.' 
      });
    }

    // Attach workspace info to request object
    req.workspaceId = workspaceId;
    req.workspaceRole = access.role;
    req.workspaceName = access.workspace_name;
    
    // Continue to next middleware
    next();

  } catch (error) {
    console.error('Authorization error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Authorization failed. Please try again.' 
    });
  }
}

// ============================================================================
// REQUIRE ROLE
// Checks if user has required role in workspace (optional - for future use)
// ============================================================================

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.workspaceRole) {
      return res.status(403).json({ 
        success: false, 
        error: 'Workspace access not verified.' 
      });
    }

    if (!allowedRoles.includes(req.workspaceRole)) {
      return res.status(403).json({ 
        success: false, 
        error: `This action requires one of the following roles: ${allowedRoles.join(', ')}` 
      });
    }

    next();
  };
}

// Export middleware functions
module.exports = { 
  authenticateUser, 
  authorizeWorkspace,
  requireRole 
};


