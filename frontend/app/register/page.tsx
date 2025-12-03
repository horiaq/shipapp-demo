'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Package, Mail, Lock, User, ArrowRight, AlertCircle, CheckCircle } from 'react-feather';

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const passwordRequirements = {
    length: formData.password.length >= 6,
    match: formData.password === formData.confirmPassword && formData.confirmPassword.length > 0
  };

  const isFormValid = 
    formData.email && 
    formData.password && 
    formData.firstName &&
    passwordRequirements.length && 
    passwordRequirements.match;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!passwordRequirements.length) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (!passwordRequirements.match) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          firstName: formData.firstName,
          lastName: formData.lastName
        })
      });

      const data = await response.json();

      if (data.success) {
        // Store token and user data
        localStorage.setItem('auth_token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        // Redirect to dashboard
        router.push('/');
      } else {
        setError(data.error || 'Registration failed');
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
            <h2>Start Your Journey</h2>
            <p>Join thousands of businesses managing their shipping operations more efficiently</p>
          </div>

          <div className="auth-features">
            <div className="feature-item">
              <div className="feature-icon">🚀</div>
              <div>
                <h3>Quick Setup</h3>
                <p>Get started in less than 2 minutes</p>
              </div>
            </div>
            <div className="feature-item">
              <div className="feature-icon">💼</div>
              <div>
                <h3>Your Own Workspace</h3>
                <p>Dedicated space for your business</p>
              </div>
            </div>
            <div className="feature-item">
              <div className="feature-icon">🎯</div>
              <div>
                <h3>No Credit Card Required</h3>
                <p>Start free, upgrade when ready</p>
              </div>
            </div>
          </div>

          <div className="auth-stats">
            <div className="stat-item">
              <div className="stat-value">10K+</div>
              <div className="stat-label">Orders Processed</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">99.9%</div>
              <div className="stat-label">Uptime</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">24/7</div>
              <div className="stat-label">Support</div>
            </div>
          </div>
        </div>

        {/* Right side - Register form */}
        <div className="auth-form-container">
          <div className="auth-form glass">
            <div className="auth-form-header">
              <h2>Create your account</h2>
              <p>Start managing your orders efficiently today</p>
            </div>

            {error && (
              <div className="alert alert-error">
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleRegister} className="auth-form-fields">
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="firstName">First Name</label>
                  <div className="input-with-icon">
                    <User size={18} />
                    <input
                      id="firstName"
                      type="text"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      placeholder="John"
                      required
                      autoComplete="given-name"
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="lastName">Last Name</label>
                  <div className="input-with-icon">
                    <User size={18} />
                    <input
                      id="lastName"
                      type="text"
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      placeholder="Doe"
                      autoComplete="family-name"
                      disabled={loading}
                    />
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="email">Email Address</label>
                <div className="input-with-icon">
                  <Mail size={18} />
                  <input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
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
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="••••••••"
                    required
                    autoComplete="new-password"
                    disabled={loading}
                  />
                </div>
                {formData.password && (
                  <div className="password-strength">
                    <div className={`strength-indicator ${passwordRequirements.length ? 'valid' : ''}`}>
                      {passwordRequirements.length ? <CheckCircle size={14} /> : <div className="strength-dot" />}
                      <span>At least 6 characters</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm Password</label>
                <div className="input-with-icon">
                  <Lock size={18} />
                  <input
                    id="confirmPassword"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    placeholder="••••••••"
                    required
                    autoComplete="new-password"
                    disabled={loading}
                  />
                </div>
                {formData.confirmPassword && (
                  <div className="password-strength">
                    <div className={`strength-indicator ${passwordRequirements.match ? 'valid' : ''}`}>
                      {passwordRequirements.match ? <CheckCircle size={14} /> : <div className="strength-dot" />}
                      <span>Passwords match</span>
                    </div>
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="action-btn action-btn-large"
                disabled={loading || !isFormValid}
              >
                {loading ? (
                  <>
                    <div className="spinner"></div>
                    <span>Creating account...</span>
                  </>
                ) : (
                  <>
                    <span>Create Account</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>

            <div className="auth-footer">
              <p>
                Already have an account?{' '}
                <a href="/login" className="auth-link">
                  Sign in instead
                </a>
              </p>
            </div>
          </div>

          {/* Terms */}
          <div className="auth-terms">
            <p>
              By creating an account, you agree to our{' '}
              <a href="#" className="auth-link">Terms of Service</a> and{' '}
              <a href="#" className="auth-link">Privacy Policy</a>
            </p>
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

        .auth-stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1.5rem;
          margin-top: 2rem;
        }

        .stat-item {
          text-align: center;
          padding: 1.5rem;
          background: var(--bg-card);
          backdrop-filter: blur(10px);
          border-radius: 16px;
          border: 1px solid var(--border-light);
        }

        .stat-value {
          font-size: 2rem;
          font-weight: 700;
          color: var(--primary);
          font-family: var(--font-outfit);
        }

        .stat-label {
          font-size: 0.75rem;
          color: var(--text-muted);
          margin-top: 0.5rem;
        }

        /* Right Side - Form */
        .auth-form-container {
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 1.5rem;
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

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }

        @media (max-width: 640px) {
          .form-row {
            grid-template-columns: 1fr;
          }
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

        .password-strength {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .strength-indicator {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.8125rem;
          color: var(--text-muted);
        }

        .strength-indicator.valid {
          color: #10b981;
        }

        .strength-indicator.valid svg {
          color: #10b981;
        }

        .strength-dot {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          border: 2px solid var(--border-light);
        }

        .action-btn-large {
          margin-top: 0.5rem;
          padding: 1rem 2rem;
          font-size: 1rem;
          font-weight: 600;
          justify-content: center;
        }

        .action-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
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

        .auth-terms {
          text-align: center;
          font-size: 0.8125rem;
          color: var(--text-muted);
          line-height: 1.6;
        }
      `}</style>
    </div>
  );
}






