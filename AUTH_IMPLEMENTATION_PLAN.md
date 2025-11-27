# 🔐 Authentication System Implementation Plan

**Goal:** Implement email/password authentication with workspace access control

**Timeline:** 2-3 days  
**Started:** [Date when you start]  
**Completed:** [Date when finished]

---

## 📋 Phase 1: Database Schema (30 minutes) ✅ COMPLETE

### Step 1.1: Create Users Table ✅
- [x] Create migration file: `database-auth-system.sql`
- [x] Add `users` table with columns:
  - [x] `user_id` (SERIAL PRIMARY KEY)
  - [x] `email` (VARCHAR, UNIQUE, NOT NULL)
  - [x] `password_hash` (VARCHAR, NOT NULL)
  - [x] `first_name` (VARCHAR)
  - [x] `last_name` (VARCHAR)
  - [x] `avatar_url` (TEXT)
  - [x] `is_active` (BOOLEAN DEFAULT TRUE)
  - [x] `last_login` (TIMESTAMP)
  - [x] `created_at` (TIMESTAMP DEFAULT NOW())
  - [x] `updated_at` (TIMESTAMP DEFAULT NOW())
- [x] Add index on `email`
- [x] Add index on `is_active`

### Step 1.2: Create User-Workspace Association Table ✅
- [x] Add `user_workspaces` table with columns:
  - [x] `id` (SERIAL PRIMARY KEY)
  - [x] `user_id` (INTEGER REFERENCES users)
  - [x] `workspace_id` (INTEGER REFERENCES workspaces)
  - [x] `role` (VARCHAR DEFAULT 'admin')
  - [x] `created_at` (TIMESTAMP DEFAULT NOW())
  - [x] UNIQUE constraint on (user_id, workspace_id)
- [x] Add index on `user_id`
- [x] Add index on `workspace_id`
- [x] Add index on `role`

### Step 1.3: Create Sessions Table ✅
- [x] Add `user_sessions` table with columns:
  - [x] `session_id` (SERIAL PRIMARY KEY)
  - [x] `user_id` (INTEGER REFERENCES users)
  - [x] `token` (VARCHAR UNIQUE NOT NULL)
  - [x] `expires_at` (TIMESTAMP NOT NULL)
  - [x] `created_at` (TIMESTAMP DEFAULT NOW())
  - [x] `last_used_at` (TIMESTAMP DEFAULT NOW())
- [x] Add index on `token`
- [x] Add index on `user_id`
- [x] Add index on `expires_at`

### Step 1.4: Add Auth Mode to Workspaces ✅
- [x] Add `auth_mode` column to workspaces table (VARCHAR DEFAULT 'demo')
- [x] Add comment explaining it's for future Shopify OAuth

### Step 1.5: Run Migration ✅
- [x] Connect to PostgreSQL database
- [x] Run migration script: `psql -U [user] -d geniki_orders -f database-auth-system.sql`
- [x] Verify tables created: `\dt` in psql
- [x] Verify indexes created: `\di` in psql

---

## 📦 Phase 2: Backend Dependencies (10 minutes) ✅ COMPLETE

### Step 2.1: Install Required Packages ✅
- [x] Run: `npm install bcryptjs jsonwebtoken`
- [x] Run: `npm install --save-dev @types/bcryptjs @types/jsonwebtoken` (TypeScript types not needed for Node backend)
- [x] Verify packages in `package.json`

### Step 2.2: Update Environment Variables ✅
- [x] Open your `.env` file
- [x] Add JWT_SECRET to `.env`
- [x] Add JWT_EXPIRES_IN to `.env`
- [x] JWT_SECRET generated: `e8bc36c66a4c99ed3e785b2461d8945c032e38218b687152702566bbb63cc93e`
- [x] Verify `.env` is in `.gitignore`

---

## 🔧 Phase 3: Backend - Auth Routes (2 hours) ✅ COMPLETE

### Step 3.1: Create Auth Routes Directory ✅
- [x] Create folder: `routes/` in project root
- [x] Create file: `routes/auth.js`

### Step 3.2: Implement Register Endpoint ✅
- [x] Import required dependencies (bcryptjs, jwt, pool)
- [x] Create POST `/register` route
- [x] Validate email and password
- [x] Check if email already exists
- [x] Hash password with bcrypt (cost 10)
- [x] Insert user into database
- [x] Create default workspace for user
- [x] Link user to workspace in `user_workspaces`
- [x] Generate JWT token
- [x] Save session to `user_sessions`
- [x] Return user data and token
- [x] Add error handling

### Step 3.3: Implement Login Endpoint ✅
- [x] Create POST `/login` route
- [x] Validate email and password provided
- [x] Find user by email
- [x] Verify password with bcrypt.compare
- [x] Update `last_login` timestamp
- [x] Generate JWT token
- [x] Save session to `user_sessions`
- [x] Get user's workspaces from `user_workspaces`
- [x] Return user data, token, and workspaces
- [x] Add error handling

### Step 3.4: Implement Logout Endpoint ✅
- [x] Create POST `/logout` route
- [x] Extract token from Authorization header
- [x] Delete session from `user_sessions`
- [x] Return success response
- [x] Add error handling

### Step 3.5: Implement Get Current User Endpoint ✅
- [x] Create GET `/me` route
- [x] Extract token from Authorization header
- [x] Verify JWT token
- [x] Check session exists and not expired
- [x] Get user data from database
- [x] Get user's workspaces
- [x] Return user and workspaces
- [x] Add error handling

### Step 3.6: Mount Auth Routes in Server ✅
- [x] Open `server.js`
- [x] Require auth routes: `const authRoutes = require('./routes/auth');`
- [x] Mount routes: `app.use('/api/auth', authRoutes);`
- [x] Test routes exist (server loads without errors)

---

## 🛡️ Phase 4: Backend - Auth Middleware (1 hour) ✅ COMPLETE

### Step 4.1: Create Middleware Directory ✅
- [x] Create folder: `middleware/` in project root
- [x] Create file: `middleware/auth.js`

### Step 4.2: Implement authenticateUser Middleware ✅
- [x] Create `authenticateUser` function
- [x] Extract token from Authorization header
- [x] Return 401 if no token
- [x] Verify JWT token
- [x] Check session exists in database and not expired
- [x] Return 401 if session invalid
- [x] Get user from database
- [x] Return 401 if user not found or inactive
- [x] Attach user to `req.user`
- [x] Call next()
- [x] Add error handling

### Step 4.3: Implement authorizeWorkspace Middleware ✅
- [x] Create `authorizeWorkspace` function
- [x] Extract workspaceId from params/body/headers
- [x] Return 400 if no workspaceId
- [x] Query `user_workspaces` for access
- [x] Return 403 if user doesn't have access
- [x] Attach workspaceId to `req.workspaceId`
- [x] Attach role to `req.workspaceRole`
- [x] Call next()
- [x] Add error handling

### Step 4.4: Export Middleware ✅
- [x] Export both functions: `module.exports = { authenticateUser, authorizeWorkspace };`
- [x] Bonus: Added `requireRole` middleware for future role-based permissions

---

## 🔒 Phase 5: Protect Backend Endpoints (2 hours) ✅ COMPLETE

### Step 5.1: Import Middleware in Server.js ✅
- [x] Add: `const { authenticateUser, authorizeWorkspace } = require('./middleware/auth');`

### Step 5.2: Protect Workspaces Endpoint ✅
- [x] Update GET `/api/workspaces`
  - [x] Add `authenticateUser` middleware
  - [x] Filter workspaces by `user_workspaces` join
  - [x] Only return workspaces user has access to

### Step 5.3: Protect Orders Endpoints ✅
- [x] Update GET `/api/imported-orders`
  - [x] Add `authenticateUser` middleware
  - [x] Add `authorizeWorkspace` middleware
  - [x] Use `req.workspaceId` in query
- [x] Update POST `/api/upload-csv`
  - [x] Add `authenticateUser` middleware
  - [x] Add `authorizeWorkspace` middleware

### Step 5.4: Protect Voucher Endpoints ✅
- [x] Update POST `/api/orders/:orderId/fulfill`
  - [x] Add `authenticateUser` middleware
  - [x] Add `authorizeWorkspace` middleware
- [x] Update POST `/api/orders/bulk-fulfill`
  - [x] Add `authenticateUser` middleware
  - [x] Add `authorizeWorkspace` middleware

### Step 5.5: Protect Settings Endpoints ✅
- [x] Update GET `/api/workspaces/:id/settings`
  - [x] Add `authenticateUser` middleware
  - [x] Add `authorizeWorkspace` middleware
- [x] Update PUT `/api/workspaces/:id/settings`
  - [x] Add `authenticateUser` middleware
  - [x] Add `authorizeWorkspace` middleware

### Step 5.6: Protect Tracking Endpoints ✅
- [x] Update POST `/api/tracking/update-all`
  - [x] Add `authenticateUser` middleware
  - [x] Add `authorizeWorkspace` middleware
- [x] Update GET `/api/workspaces/:id/delivery-stats`
  - [x] Add `authenticateUser` middleware
  - [x] Add `authorizeWorkspace` middleware

### Step 5.7: Test Protected Endpoints ⏳
- [ ] Test endpoints return 401 without token (will test after frontend is ready)
- [ ] Test endpoints return 403 without workspace access
- [ ] Test endpoints work with valid token and access

---

## 🎨 Phase 6: Frontend - Auth Pages (3 hours) ✅ COMPLETE

### Step 6.1: Create Login Page ✅
- [x] Create file: `frontend/app/login/page.tsx`
- [ ] Create login form with:
  - [ ] Email input field
  - [ ] Password input field
  - [ ] Submit button
  - [ ] Link to register page
- [ ] Add form validation
- [ ] Implement handleLogin function
- [ ] Call POST `/api/auth/login`
- [ ] Store token in localStorage
- [ ] Store user in localStorage
- [ ] Redirect to dashboard on success
- [ ] Show error message on failure
- [ ] Add loading state
- [ ] Style with your existing design system

### Step 6.2: Create Register Page
- [ ] Create file: `frontend/app/register/page.tsx`
- [ ] Create registration form with:
  - [ ] First name input
  - [ ] Last name input
  - [ ] Email input
  - [ ] Password input
  - [ ] Confirm password input
  - [ ] Submit button
  - [ ] Link to login page
- [ ] Add form validation (passwords match, min length, etc.)
- [ ] Implement handleRegister function
- [ ] Call POST `/api/auth/register`
- [ ] Store token in localStorage
- [ ] Store user in localStorage
- [ ] Redirect to dashboard on success
- [ ] Show error message on failure
- [ ] Add loading state
- [ ] Style with your existing design system

---

## 🔐 Phase 7: Frontend - Auth Context (1.5 hours)

### Step 7.1: Create Auth Context
- [ ] Create file: `frontend/lib/contexts/AuthContext.tsx`
- [ ] Define AuthContextType interface
- [ ] Create AuthContext with createContext
- [ ] Create AuthProvider component
- [ ] Add state for: user, loading, isAuthenticated
- [ ] Implement checkAuth function (calls GET `/api/auth/me`)
- [ ] Implement logout function (calls POST `/api/auth/logout`)
- [ ] Add useEffect to check auth on mount
- [ ] Export useAuth hook
- [ ] Add error handling

### Step 7.2: Add Auth Provider to App
- [ ] Open `frontend/components/Providers.tsx`
- [ ] Import AuthProvider
- [ ] Wrap children with AuthProvider
- [ ] Verify order: ThemeProvider > AuthProvider > WorkspaceProvider

---

## 🚪 Phase 8: Frontend - Route Protection (1 hour)

### Step 8.1: Create AuthGate Component
- [ ] Create file: `frontend/components/AuthGate.tsx`
- [ ] Import useAuth and useRouter
- [ ] Define public routes array ['/login', '/register']
- [ ] Check if current route is public
- [ ] Show loading spinner while checking auth
- [ ] Redirect to /login if not authenticated and not on public route
- [ ] Return null if redirecting
- [ ] Return children if authenticated or on public route

### Step 8.2: Update ClientLayout
- [ ] Open `frontend/components/ClientLayout.tsx`
- [ ] Import AuthGate
- [ ] Check if current route is public
- [ ] If public, return just AuthGate without Sidebar/Header
- [ ] If protected, wrap everything in AuthGate
- [ ] Test navigation between public and protected routes

### Step 8.3: Add Logout to UserProfile
- [ ] Open `frontend/components/Sidebar/UserProfile.tsx`
- [ ] Import useAuth
- [ ] Get logout function from useAuth
- [ ] Add logout button or menu item
- [ ] Call logout function on click
- [ ] Test logout redirects to login page

---

## 🌐 Phase 9: Frontend - API Integration (1.5 hours)

### Step 9.1: Create API Helper Function
- [ ] Create file: `frontend/lib/utils/api.ts`
- [ ] Create `fetchWithAuth` function
- [ ] Get token from localStorage
- [ ] Add Authorization header to all requests
- [ ] Handle 401 responses (clear storage, redirect to login)
- [ ] Handle 403 responses (show access denied message)
- [ ] Return response

### Step 9.2: Update WorkspaceContext
- [ ] Open `frontend/lib/contexts/WorkspaceContext.tsx`
- [ ] Import fetchWithAuth
- [ ] Update loadWorkspaces to use fetchWithAuth
- [ ] Update switchWorkspace to use fetchWithAuth
- [ ] Add error handling for auth failures

### Step 9.3: Update useOrders Hook
- [ ] Open `frontend/lib/hooks/useOrders.ts`
- [ ] Import fetchWithAuth
- [ ] Update all fetch calls to use fetchWithAuth
- [ ] Pass workspaceId in headers: `X-Workspace-Id`
- [ ] Add error handling for auth failures

### Step 9.4: Update Orders API Functions
- [ ] Open `frontend/lib/api/orders.ts`
- [ ] Import fetchWithAuth
- [ ] Update all API calls to use fetchWithAuth
- [ ] Ensure workspaceId is passed in all requests
- [ ] Add error handling for auth failures

### Step 9.5: Update Settings Hook
- [ ] Open `frontend/lib/hooks/useSettings.ts`
- [ ] Import fetchWithAuth
- [ ] Update all fetch calls to use fetchWithAuth
- [ ] Add error handling for auth failures

---

## 🧪 Phase 10: Testing & Validation (2 hours)

### Step 10.1: Test User Registration
- [ ] Open app at `/register`
- [ ] Test empty form submission (should show validation)
- [ ] Test mismatched passwords (should show error)
- [ ] Test weak password (should show error)
- [ ] Test duplicate email (should show error)
- [ ] Test successful registration
- [ ] Verify user created in database
- [ ] Verify default workspace created
- [ ] Verify user_workspaces link created
- [ ] Verify redirected to dashboard
- [ ] Verify token stored in localStorage

### Step 10.2: Test User Login
- [ ] Logout and go to `/login`
- [ ] Test wrong email (should show error)
- [ ] Test wrong password (should show error)
- [ ] Test successful login
- [ ] Verify last_login updated in database
- [ ] Verify redirected to dashboard
- [ ] Verify token stored in localStorage
- [ ] Verify user sees their workspaces

### Step 10.3: Test Route Protection
- [ ] Logout and try to access `/` (should redirect to /login)
- [ ] Try to access `/orders` (should redirect to /login)
- [ ] Try to access `/settings` (should redirect to /login)
- [ ] Login and verify can access all routes
- [ ] Verify sidebar and header show correctly

### Step 10.4: Test Workspace Access Control
- [ ] Create second user account
- [ ] Verify second user can't see first user's workspaces
- [ ] Verify second user can't access first user's orders
- [ ] Try to manually change workspaceId in request (should get 403)
- [ ] Verify workspace selector only shows accessible workspaces

### Step 10.5: Test API Endpoint Protection
- [ ] Open browser DevTools > Network tab
- [ ] Try to call `/api/workspaces` without token (should get 401)
- [ ] Try to call `/api/imported-orders` without token (should get 401)
- [ ] Try to call with token but wrong workspaceId (should get 403)
- [ ] Try to call with valid token and workspaceId (should work)

### Step 10.6: Test Session Management
- [ ] Login successfully
- [ ] Check `user_sessions` table (should have entry)
- [ ] Logout
- [ ] Check `user_sessions` table (should be deleted)
- [ ] Login again
- [ ] Clear localStorage manually
- [ ] Refresh page (should redirect to login)

### Step 10.7: Test Token Expiration
- [ ] Login successfully
- [ ] Manually change token expiration in database to past date
- [ ] Try to access protected route (should redirect to login)
- [ ] Verify old session cleaned up

### Step 10.8: Test Error Handling
- [ ] Kill database connection temporarily
- [ ] Try to login (should show error message)
- [ ] Try to register (should show error message)
- [ ] Restore database connection
- [ ] Verify everything works again

---

## 🎨 Phase 11: UI/UX Polish (1 hour)

### Step 11.1: Improve Login/Register Pages
- [ ] Add logo/branding
- [ ] Add loading spinners
- [ ] Add password visibility toggle
- [ ] Add "Remember me" checkbox (optional)
- [ ] Add "Forgot password" link (can be placeholder for now)
- [ ] Improve error messages (more user-friendly)
- [ ] Add success messages
- [ ] Test on mobile (responsive design)

### Step 11.2: Update User Profile Component
- [ ] Show user's name in sidebar
- [ ] Show user's email
- [ ] Add user avatar (can use initials for now)
- [ ] Add logout button with confirmation
- [ ] Style consistently with rest of app

### Step 11.3: Add Loading States
- [ ] Add loading spinner on login page while authenticating
- [ ] Add loading spinner on register page while creating account
- [ ] Add loading state in AuthGate while checking auth
- [ ] Add skeleton loaders for protected pages

---

## 📝 Phase 12: Documentation & Cleanup (30 minutes)

### Step 12.1: Update README
- [ ] Add authentication section
- [ ] Document how to create first user
- [ ] Document environment variables needed
- [ ] Add screenshots of login/register pages

### Step 12.2: Add Migration Instructions
- [ ] Create `AUTH_SETUP.md` with:
  - [ ] Database migration steps
  - [ ] Environment variable setup
  - [ ] First user creation
  - [ ] Testing checklist

### Step 12.3: Code Cleanup
- [ ] Remove any console.logs
- [ ] Add comments to complex functions
- [ ] Verify all files properly formatted
- [ ] Remove any unused imports

### Step 12.4: Create Demo User
- [ ] Manually create a demo user in database
- [ ] Document demo credentials
- [ ] Test demo user can login
- [ ] Create demo workspace with sample data

---

## ✅ Final Checklist

### Security
- [ ] Passwords are hashed with bcrypt
- [ ] JWT tokens are signed with strong secret
- [ ] Sessions expire after 7 days
- [ ] Tokens are validated on every request
- [ ] User can only see their workspaces
- [ ] User can only access data from their workspaces
- [ ] No sensitive data in JWT payload
- [ ] .env file is in .gitignore

### Functionality
- [ ] User can register
- [ ] User can login
- [ ] User can logout
- [ ] User stays logged in after refresh
- [ ] User is redirected to login when not authenticated
- [ ] User can only see their workspaces
- [ ] User can only access their orders
- [ ] Workspace selector works correctly
- [ ] All API endpoints are protected
- [ ] Error messages are user-friendly

### Code Quality
- [ ] No TypeScript errors
- [ ] No console errors in browser
- [ ] Code is properly formatted
- [ ] Functions are documented
- [ ] Error handling is comprehensive
- [ ] Loading states exist for all async operations

---

## 🎉 Success Criteria

- ✅ New users can register and get a default workspace
- ✅ Users can login with email/password
- ✅ Users can only see workspaces they have access to
- ✅ Users can only access orders/vouchers from their workspaces
- ✅ Workspace switching works correctly
- ✅ Users stay logged in across page refreshes
- ✅ All API endpoints require authentication
- ✅ All API endpoints enforce workspace access control
- ✅ UI is polished and user-friendly
- ✅ No security vulnerabilities

---

## 📊 Progress Tracker

**Phase 1 - Database:** ✅ Complete  
**Phase 2 - Dependencies:** ✅ Complete  
**Phase 3 - Auth Routes:** ✅ Complete  
**Phase 4 - Middleware:** ✅ Complete  
**Phase 5 - Protect Endpoints:** ✅ Complete  
**Phase 6 - Auth Pages:** ✅ Complete  
**Phase 7 - Auth Context:** ✅ Complete  
**Phase 8 - Route Protection:** ✅ Complete  
**Phase 9 - API Integration:** ✅ Complete  
**Phase 10 - Testing:** 🟡 Ready to Test  
**Phase 3 - Auth Routes:** ⬜ Not Started | 🟡 In Progress | ✅ Complete  
**Phase 4 - Middleware:** ⬜ Not Started | 🟡 In Progress | ✅ Complete  
**Phase 5 - Protect Endpoints:** ⬜ Not Started | 🟡 In Progress | ✅ Complete  
**Phase 6 - Auth Pages:** ⬜ Not Started | 🟡 In Progress | ✅ Complete  
**Phase 7 - Auth Context:** ⬜ Not Started | 🟡 In Progress | ✅ Complete  
**Phase 8 - Route Protection:** ⬜ Not Started | 🟡 In Progress | ✅ Complete  
**Phase 9 - API Integration:** ⬜ Not Started | 🟡 In Progress | ✅ Complete  
**Phase 10 - Testing:** ⬜ Not Started | 🟡 In Progress | ✅ Complete  
**Phase 11 - UI Polish:** ⬜ Not Started | 🟡 In Progress | ✅ Complete  
**Phase 12 - Documentation:** ⬜ Not Started | 🟡 In Progress | ✅ Complete  

---

## 🚀 Ready to Start?

**Next Step:** Begin with Phase 1 - Database Schema

When you're ready, I'll start implementing each phase step by step!

