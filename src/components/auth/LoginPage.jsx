// Login Page
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Building2, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { loginWithEmail, loginWithGoogle, getUserProfile } from '../../services/authService';
import { getAuthErrorMessage } from '../../utils/validators';
import { useToast } from '../../contexts/ToastContext';

export default function LoginPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please enter email and password.');
      return;
    }
    sessionStorage.clear();
    setLoading(true);
    try {
      const user = await loginWithEmail(email, password);
      const profile = await getUserProfile(user.uid);
      
      if (!profile) {
        toast.error('Account not found. Please register first.');
        setLoading(false);
        return;
      }

      if (profile.status === 'disabled') {
        toast.error('Your account has been disabled. Contact your administrator.');
        setLoading(false);
        return;
      }

      toast.success('Welcome back!');
      if (profile.role === 'admin') {
        navigate('/select-company');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      toast.error(getAuthErrorMessage(err.code));
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    sessionStorage.clear();
    setLoading(true);
    try {
      const user = await loginWithGoogle();
      const profile = await getUserProfile(user.uid);
      
      if (!profile) {
        // New Google user - redirect to register
        toast.info('Please complete your registration.');
        navigate('/register');
        return;
      }

      if (profile.status === 'disabled') {
        toast.error('Your account has been disabled. Contact your administrator.');
        setLoading(false);
        return;
      }

      toast.success('Welcome back!');
      if (profile.role === 'admin') {
        navigate('/select-company');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      toast.error(getAuthErrorMessage(err.code));
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-logo">
            <div className="auth-logo-icon">
              <Building2 size={24} />
            </div>
            <h1>BizManager</h1>
            <p>Business Management System</p>
          </div>

          <h2 className="auth-title">Welcome back</h2>
          <p className="auth-subtitle">Sign in to manage your business</p>

          <form className="auth-form" onSubmit={handleEmailLogin}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
                <input
                  type="email"
                  className="form-input"
                  style={{ paddingLeft: 36 }}
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  style={{ paddingLeft: 36, paddingRight: 40 }}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--gray-400)', cursor: 'pointer' }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading}>
              {loading ? <span className="loading-spinner" /> : 'Sign In'}
            </button>
          </form>

          <div className="auth-divider">or</div>

          <button
            className="btn btn-google btn-block btn-lg"
            onClick={handleGoogleLogin}
            disabled={loading}
          >
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/>
              <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"/>
              <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18l2.67-2.07z"/>
              <path fill="#EA4335" d="M8.98 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A8 8 0 0 0 1.83 5.41l2.67 2.07A4.77 4.77 0 0 1 8.98 3.58z"/>
            </svg>
            Sign in with Google
          </button>

          <div className="auth-footer">
            Don't have an account? <Link to="/register">Create account</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
