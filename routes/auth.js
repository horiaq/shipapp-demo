// ============================================================================
// Authentication Routes
// Email/password authentication for demo/internal use
// ============================================================================

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Get database pool from parent
// This will be passed when mounting the router
let pool;

router.setPool = (dbPool) => {
  pool = dbPool;
};

// ============================================================================
// REGISTER - Create new user account
// POST /api/auth/register
// ============================================================================

router.post('/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email and password are required' 
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid email format' 
      });
    }

    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({ 
        success: false, 
        error: 'Password must be at least 6 characters' 
      });
    }

    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email already registered' 
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const userResult = await pool.query(
      `INSERT INTO users (email, password_hash, first_name, last_name) 
       VALUES ($1, $2, $3, $4) 
       RETURNING user_id, email, first_name, last_name, created_at`,
      [email.toLowerCase(), passwordHash, firstName || null, lastName || null]
    );

    const user = userResult.rows[0];

    // Create default workspace for this user
    const workspaceName = firstName ? `${firstName}'s Workspace` : `${email.split('@')[0]}'s Workspace`;
    const workspaceResult = await pool.query(
      `INSERT INTO workspaces (workspace_name, store_name, auth_mode, is_active) 
       VALUES ($1, $2, 'demo', TRUE) 
       RETURNING workspace_id, workspace_name`,
      [workspaceName, workspaceName]
    );

    const workspace = workspaceResult.rows[0];

    // Link user to workspace as admin
    await pool.query(
      'INSERT INTO user_workspaces (user_id, workspace_id, role) VALUES ($1, $2, $3)',
      [user.user_id, workspace.workspace_id, 'admin']
    );

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.user_id, email: user.email },
      process.env.JWT_SECRET || 'demo-secret-key',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Save session
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

    await pool.query(
      'INSERT INTO user_sessions (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.user_id, token, expiresAt]
    );

    console.log(`✅ New user registered: ${user.email} (ID: ${user.user_id})`);

    // Return user data and token
    res.json({
      success: true,
      user: {
        user_id: user.user_id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name
      },
      workspace: {
        workspace_id: workspace.workspace_id,
        workspace_name: workspace.workspace_name
      },
      token
    });

  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Registration failed. Please try again.' 
    });
  }
});

// ============================================================================
// LOGIN - Authenticate user
// POST /api/auth/login
// ============================================================================

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email and password are required' 
      });
    }

    // Find user by email
    const userResult = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid email or password' 
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

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!validPassword) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid email or password' 
      });
    }

    // Update last login timestamp
    await pool.query(
      'UPDATE users SET last_login = NOW() WHERE user_id = $1',
      [user.user_id]
    );

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.user_id, email: user.email },
      process.env.JWT_SECRET || 'demo-secret-key',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Save session
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

    await pool.query(
      'INSERT INTO user_sessions (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.user_id, token, expiresAt]
    );

    // Get user's workspaces
    const workspacesResult = await pool.query(
      `SELECT w.workspace_id, w.workspace_name, w.store_name, w.shopify_shop, 
              w.is_active, w.invoice_currency, w.invoice_language, uw.role
       FROM workspaces w
       JOIN user_workspaces uw ON w.workspace_id = uw.workspace_id
       WHERE uw.user_id = $1 AND w.is_active = TRUE
       ORDER BY w.created_at ASC`,
      [user.user_id]
    );

    console.log(`✅ User logged in: ${user.email} (ID: ${user.user_id})`);

    // Return user data, workspaces, and token
    res.json({
      success: true,
      user: {
        user_id: user.user_id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        last_login: user.last_login
      },
      workspaces: workspacesResult.rows,
      token
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Login failed. Please try again.' 
    });
  }
});

// ============================================================================
// LOGOUT - End user session
// POST /api/auth/logout
// ============================================================================

router.post('/logout', async (req, res) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      // Delete session from database
      await pool.query(
        'DELETE FROM user_sessions WHERE token = $1',
        [token]
      );

      console.log('✅ User logged out successfully');
    }

    res.json({ 
      success: true, 
      message: 'Logged out successfully' 
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Logout failed' 
    });
  }
});

// ============================================================================
// GET CURRENT USER - Get authenticated user info
// GET /api/auth/me
// ============================================================================

router.get('/me', async (req, res) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        error: 'No token provided' 
      });
    }

    const token = authHeader.substring(7);

    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'demo-secret-key');
    } catch (err) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid or expired token' 
      });
    }

    // Check session exists and is not expired
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

    // Update last_used_at
    await pool.query(
      'UPDATE user_sessions SET last_used_at = NOW() WHERE token = $1',
      [token]
    );

    // Get user data
    const userResult = await pool.query(
      'SELECT user_id, email, first_name, last_name, is_active, last_login FROM users WHERE user_id = $1',
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ 
        success: false, 
        error: 'User not found' 
      });
    }

    const user = userResult.rows[0];

    if (!user.is_active) {
      return res.status(401).json({ 
        success: false, 
        error: 'Account is disabled' 
      });
    }

    // Get user's workspaces
    const workspacesResult = await pool.query(
      `SELECT w.workspace_id, w.workspace_name, w.store_name, w.shopify_shop, 
              w.is_active, w.invoice_currency, w.invoice_language, uw.role
       FROM workspaces w
       JOIN user_workspaces uw ON w.workspace_id = uw.workspace_id
       WHERE uw.user_id = $1 AND w.is_active = TRUE
       ORDER BY w.created_at ASC`,
      [user.user_id]
    );

    // Return user and workspaces
    res.json({
      success: true,
      user: {
        user_id: user.user_id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        last_login: user.last_login
      },
      workspaces: workspacesResult.rows
    });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get user information' 
    });
  }
});

module.exports = router;

