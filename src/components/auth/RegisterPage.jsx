// Register Page — Admin & Employee Registration
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Building2, Users, Mail, Lock, Eye, EyeOff, User, Phone, KeyRound, Briefcase } from 'lucide-react';
import { registerAdmin, registerEmployee } from '../../services/authService';
import { getAuthErrorMessage, validateEmail, validatePassword, validateRequired, validateAdminCode } from '../../utils/validators';
import { useToast } from '../../contexts/ToastContext';

export default function RegisterPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [accountType, setAccountType] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Admin fields
  const [adminForm, setAdminForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
  });

  // Employee fields
  const [employeeForm, setEmployeeForm] = useState({
    name: '',
    email: '',
    password: '',
    adminCode: '',
  });

  const [errors, setErrors] = useState({});

  const validateAdminForm = () => {
    const errs = {};
    errs.name = validateRequired(adminForm.name, 'Full name');
    errs.email = validateEmail(adminForm.email);
    errs.password = validatePassword(adminForm.password);
    setErrors(errs);
    return !Object.values(errs).some(Boolean);
  };

  const validateEmployeeForm = () => {
    const errs = {};
    errs.name = validateRequired(employeeForm.name, 'Full name');
    errs.email = validateEmail(employeeForm.email);
    errs.password = validatePassword(employeeForm.password);
    errs.adminCode = validateAdminCode(employeeForm.adminCode);
    setErrors(errs);
    return !Object.values(errs).some(Boolean);
  };

  const handleAdminRegister = async (e) => {
    e.preventDefault();
    if (!validateAdminForm()) return;
    setLoading(true);
    try {
      await registerAdmin(adminForm);
      // Auth context will redirect to dashboard
    } catch (err) {
      toast.error(getAuthErrorMessage(err.code) || err.message);
      setLoading(false);
    }
  };

  const handleEmployeeRegister = async (e) => {
    e.preventDefault();
    if (!validateEmployeeForm()) return;
    setLoading(true);
    try {
      const result = await registerEmployee(employeeForm);
      toast.success(`Account created! Connected to ${result.companyName}`);
      // Auth context will redirect
    } catch (err) {
      toast.error(getAuthErrorMessage(err.code) || err.message);
      setLoading(false);
    }
  };

  const handleAdminGoogleRegister = async () => {
    setLoading(true);
    try {
      await registerAdmin({
        ...adminForm,
        useGoogle: true,
      });
      // Auth context will redirect to dashboard
    } catch (err) {
      toast.error(getAuthErrorMessage(err.code) || err.message);
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

          <h2 className="auth-title">Create your account</h2>
          <p className="auth-subtitle">Select your account type</p>

          {/* Account Type Selector */}
          <div className="account-type-selector">
            <div
              className={`account-type-card admin ${accountType === 'admin' ? 'active' : ''}`}
              onClick={() => { setAccountType('admin'); setErrors({}); }}
            >
              <div className="type-icon">
                <Briefcase size={20} />
              </div>
              <div className="type-label">Business Admin</div>
              <div className="type-desc">Create & manage a company</div>
            </div>
            <div
              className={`account-type-card employee ${accountType === 'employee' ? 'active' : ''}`}
              onClick={() => { setAccountType('employee'); setErrors({}); }}
            >
              <div className="type-icon">
                <Users size={20} />
              </div>
              <div className="type-label">Employee</div>
              <div className="type-desc">Join an existing company</div>
            </div>
          </div>

          {/* Admin Registration Form */}
          {accountType === 'admin' && (
            <form className="auth-form" onSubmit={handleAdminRegister}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <div style={{ position: 'relative' }}>
                  <User size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
                  <input
                    type="text"
                    className={`form-input ${errors.name ? 'error' : ''}`}
                    style={{ paddingLeft: 36 }}
                    placeholder="Enter your full name"
                    value={adminForm.name}
                    onChange={(e) => setAdminForm({ ...adminForm, name: e.target.value })}
                    disabled={loading}
                  />
                </div>
                {errors.name && <span className="form-error">{errors.name}</span>}
              </div>



              <div className="form-group">
                <label className="form-label">Email</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
                  <input
                    type="email"
                    className={`form-input ${errors.email ? 'error' : ''}`}
                    style={{ paddingLeft: 36 }}
                    placeholder="Enter your email"
                    value={adminForm.email}
                    onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                    disabled={loading}
                  />
                </div>
                {errors.email && <span className="form-error">{errors.email}</span>}
              </div>

              <div className="form-group">
                <label className="form-label">Phone <span className="text-muted text-xs">(optional)</span></label>
                <div style={{ position: 'relative' }}>
                  <Phone size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
                  <input
                    type="tel"
                    className="form-input"
                    style={{ paddingLeft: 36 }}
                    placeholder="Phone number"
                    value={adminForm.phone}
                    onChange={(e) => setAdminForm({ ...adminForm, phone: e.target.value })}
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
                    className={`form-input ${errors.password ? 'error' : ''}`}
                    style={{ paddingLeft: 36, paddingRight: 40 }}
                    placeholder="Create a password"
                    value={adminForm.password}
                    onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
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
                {errors.password && <span className="form-error">{errors.password}</span>}
              </div>

              <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading}>
                {loading ? <span className="loading-spinner" /> : 'Create Admin Account'}
              </button>

              <div className="auth-divider">or</div>

              <button
                type="button"
                className="btn btn-google btn-block btn-lg"
                onClick={handleAdminGoogleRegister}
                disabled={loading}
              >
                <svg width="18" height="18" viewBox="0 0 18 18">
                  <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/>
                  <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"/>
                  <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18l2.67-2.07z"/>
                  <path fill="#EA4335" d="M8.98 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A8 8 0 0 0 1.83 5.41l2.67 2.07A4.77 4.77 0 0 1 8.98 3.58z"/>
                </svg>
                Sign up with Google
              </button>
            </form>
          )}

          {/* Employee Registration Form */}
          {accountType === 'employee' && (
            <form className="auth-form" onSubmit={handleEmployeeRegister}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <div style={{ position: 'relative' }}>
                  <User size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
                  <input
                    type="text"
                    className={`form-input ${errors.name ? 'error' : ''}`}
                    style={{ paddingLeft: 36 }}
                    placeholder="Enter your full name"
                    value={employeeForm.name}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, name: e.target.value })}
                    disabled={loading}
                  />
                </div>
                {errors.name && <span className="form-error">{errors.name}</span>}
              </div>

              <div className="form-group">
                <label className="form-label">Email</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
                  <input
                    type="email"
                    className={`form-input ${errors.email ? 'error' : ''}`}
                    style={{ paddingLeft: 36 }}
                    placeholder="Enter your email"
                    value={employeeForm.email}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, email: e.target.value })}
                    disabled={loading}
                  />
                </div>
                {errors.email && <span className="form-error">{errors.email}</span>}
              </div>

              <div className="form-group">
                <label className="form-label">Password</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className={`form-input ${errors.password ? 'error' : ''}`}
                    style={{ paddingLeft: 36, paddingRight: 40 }}
                    placeholder="Create a password"
                    value={employeeForm.password}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, password: e.target.value })}
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
                {errors.password && <span className="form-error">{errors.password}</span>}
              </div>

              <div className="form-group">
                <label className="form-label">Admin Code</label>
                <div style={{ position: 'relative' }}>
                  <KeyRound size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
                  <input
                    type="text"
                    className={`form-input ${errors.adminCode ? 'error' : ''}`}
                    style={{ paddingLeft: 36, textTransform: 'uppercase', letterSpacing: '1px', fontFamily: "'SF Mono', 'Fira Code', monospace" }}
                    placeholder="TF-X72K91"
                    value={employeeForm.adminCode}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, adminCode: e.target.value.toUpperCase() })}
                    disabled={loading}
                  />
                </div>
                {errors.adminCode && <span className="form-error">{errors.adminCode}</span>}
                <span className="form-hint">Ask your administrator for this code</span>
              </div>

              <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading}>
                {loading ? <span className="loading-spinner" /> : 'Create Employee Account'}
              </button>
            </form>
          )}

          {!accountType && (
            <p className="text-center text-muted text-sm" style={{ marginTop: 'var(--space-4)' }}>
              Select an account type above to continue
            </p>
          )}

          <div className="auth-footer">
            Already have an account? <Link to="/login">Sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
