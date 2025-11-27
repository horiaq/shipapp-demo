'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Package, Mail, Lock, ArrowRight, AlertCircle } from 'react-feather';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (data.success) {
        // Store token and user data
        localStorage.setItem('auth_token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        // Store workspaces if returned
        if (data.workspaces && data.workspaces.length > 0) {
          // Set first workspace as default if none selected
          const savedWorkspaceId = localStorage.getItem('currentWorkspaceId');
          if (!savedWorkspaceId) {
            localStorage.setItem('currentWorkspaceId', data.workspaces[0].workspace_id.toString());
          }
        }
        
        // Force a full page reload to ensure all contexts load fresh
        window.location.href = '/';
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (err) {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      {/* Animated background gradient */}
      <div className="auth-bg-gradient"></div>

      <div className="auth-content">
        {/* Left side - Branding */}
        <div className="auth-branding">
          <div className="auth-logo">
            <div className="logo-icon-large">
              <Package size={48} strokeWidth={1.5} />
            </div>
            <h1 className="logo-text-large">NEXUS</h1>
          </div>
          
          <div className="auth-tagline">
            <h2>Advanced Order Management</h2>
            <p>Streamline your shipping workflow with automated label creation and Oblio invoicing</p>
          </div>

          <div className="auth-features">
            <div className="feature-item">
              <div className="feature-icon">✨</div>
              <div>
                <h3>Real-time Tracking</h3>
                <p>Monitor all deliveries in one place</p>
              </div>
            </div>
            <div className="feature-item">
              <div className="feature-icon">⚡</div>
              <div>
                <h3>Automated Workflows</h3>
                <p>Save hours with bulk operations</p>
              </div>
            </div>
            <div className="feature-item">
              <div className="feature-icon">🔒</div>
              <div>
                <h3>Multi-Workspace</h3>
                <p>Manage multiple stores securely</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right side - Login form */}
        <div className="auth-form-container">
          <div className="auth-form glass">
            <div className="auth-form-header">
              <h2>Welcome back</h2>
              <p>Sign in to your account to continue</p>
            </div>

            {error && (
              <div className="alert alert-error">
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="auth-form-fields">
              <div className="form-group">
                <label htmlFor="email">Email Address</label>
                <div className="input-with-icon">
                  <Mail size={18} />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                    autoComplete="email"
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="password">Password</label>
                <div className="input-with-icon">
                  <Lock size={18} />
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                    disabled={loading}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="action-btn action-btn-large"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <div className="spinner"></div>
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>

            <div className="auth-footer">
              <p>
                Don't have an account?{' '}
                <a href="/register" className="auth-link">
                  Create one now
                </a>
              </p>
            </div>
          </div>

          {/* Trust badges */}
          <div className="auth-trust-badges">
            <div className="trust-badge">
              <span className="trust-icon">🔒</span>
              <span>256-bit SSL Encryption</span>
            </div>
            <div className="trust-badge">
              <span className="trust-icon">⚡</span>
              <span>99.9% Uptime</span>
            </div>
            <div className="trust-badge">
              <span className="trust-icon">🛡️</span>
              <span>GDPR Compliant</span>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .auth-container {
          min-height: 100vh;
          position: relative;
          overflow: hidden;
          background: var(--bg-dark);
        }

        .auth-bg-gradient {
          position: fixed;
          inset: 0;
          background-image:
            radial-gradient(circle at 10% 20%, rgba(6, 182, 212, 0.15) 0%, transparent 50%),
            radial-gradient(circle at 90% 80%, rgba(139, 92, 246, 0.15) 0%, transparent 50%);
          animation: gradientShift 20s ease infinite;
          pointer-events: none;
        }

        @keyframes gradientShift {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.1); }
        }

        .auth-content {
          position: relative;
          min-height: 100vh;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 4rem;
          padding: 4rem;
          max-width: 1600px;
          margin: 0 auto;
        }

        @media (max-width: 1024px) {
          .auth-content {
            grid-template-columns: 1fr;
            gap: 3rem;
            padding: 2rem;
          }
          .auth-branding {
            display: none;
          }
        }

        /* Left Side - Branding */
        .auth-branding {
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 3rem;
        }

        .auth-logo {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .logo-icon-large {
          width: 80px;
          height: 80px;
          border-radius: 20px;
          background: linear-gradient(135deg, var(--primary), var(--secondary));
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          box-shadow: 0 20px 60px rgba(6, 182, 212, 0.3);
        }

        .logo-text-large {
          font-size: 3rem;
          font-weight: 700;
          font-family: var(--font-outfit);
          background: linear-gradient(to right, var(--primary), var(--secondary));
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          letter-spacing: -0.02em;
        }

        .auth-tagline h2 {
          font-size: 2.5rem;
          font-weight: 600;
          color: var(--text-main);
          margin-bottom: 1rem;
          font-family: var(--font-outfit);
        }

        .auth-tagline p {
          font-size: 1.125rem;
          color: var(--text-muted);
          line-height: 1.7;
        }

        .auth-features {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          margin-top: 2rem;
        }

        .feature-item {
          display: flex;
          gap: 1rem;
          padding: 1.5rem;
          background: var(--bg-card);
          backdrop-filter: blur(10px);
          border-radius: 16px;
          border: 1px solid var(--border-light);
          transition: all 0.3s ease;
        }

        .feature-item:hover {
          transform: translateX(8px);
          box-shadow: 0 8px 30px rgba(6, 182, 212, 0.1);
        }

        .feature-icon {
          font-size: 2rem;
          line-height: 1;
        }

        .feature-item h3 {
          font-size: 1.125rem;
          font-weight: 600;
          color: var(--text-main);
          margin-bottom: 0.25rem;
        }

        .feature-item p {
          font-size: 0.875rem;
          color: var(--text-muted);
        }

        /* Right Side - Form */
        .auth-form-container {
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 2rem;
        }

        .auth-form {
          padding: 3rem;
          background: var(--bg-panel);
          backdrop-filter: blur(20px);
          border-radius: 24px;
          border: 1px solid var(--border-light);
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.1);
        }

        .auth-form-header {
          margin-bottom: 2rem;
        }

        .auth-form-header h2 {
          font-size: 2rem;
          font-weight: 600;
          color: var(--text-main);
          margin-bottom: 0.5rem;
          font-family: var(--font-outfit);
        }

        .auth-form-header p {
          color: var(--text-muted);
          font-size: 0.9375rem;
        }

        .alert {
          padding: 1rem;
          border-radius: 12px;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 1.5rem;
          font-size: 0.875rem;
        }

        .alert-error {
          background: rgba(244, 63, 94, 0.1);
          border: 1px solid rgba(244, 63, 94, 0.3);
          color: var(--accent);
        }

        .auth-form-fields {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .form-group label {
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--text-main);
        }

        .input-with-icon {
          position: relative;
          display: flex;
          align-items: center;
        }

        .input-with-icon svg {
          position: absolute;
          left: 1rem;
          color: var(--text-muted);
          pointer-events: none;
        }

        .input-with-icon input {
          width: 100%;
          padding: 1rem 1rem 1rem 3rem;
          background: var(--bg-card);
          border: 1px solid var(--border-light);
          border-radius: 12px;
          color: var(--text-main);
          font-size: 0.9375rem;
          transition: all 0.2s ease;
        }

        .input-with-icon input:focus {
          outline: none;
          border-color: var(--primary);
          box-shadow: 0 0 0 3px var(--primary-glow);
          background: var(--bg-panel);
        }

        .input-with-icon input:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .input-with-icon input::placeholder {
          color: var(--text-dim);
        }

        .action-btn-large {
          margin-top: 0.5rem;
          padding: 1rem 2rem;
          font-size: 1rem;
          font-weight: 600;
          justify-content: center;
        }

        .spinner {
          width: 18px;
          height: 18px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .auth-footer {
          margin-top: 2rem;
          padding-top: 2rem;
          border-top: 1px solid var(--border-light);
          text-align: center;
        }

        .auth-footer p {
          font-size: 0.9375rem;
          color: var(--text-muted);
        }

        .auth-link {
          color: var(--primary);
          font-weight: 500;
          text-decoration: none;
          transition: color 0.2s ease;
        }

        .auth-link:hover {
          color: var(--secondary);
        }

        .auth-trust-badges {
          display: flex;
          gap: 1rem;
          justify-content: center;
          flex-wrap: wrap;
        }

        .trust-badge {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1rem;
          background: var(--bg-card);
          backdrop-filter: blur(10px);
          border-radius: 12px;
          border: 1px solid var(--border-light);
          font-size: 0.8125rem;
          color: var(--text-muted);
        }

        .trust-icon {
          font-size: 1rem;
        }
      `}</style>
    </div>
  );
}

