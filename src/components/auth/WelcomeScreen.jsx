// Welcome Screen — Shown after admin registration
import { useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle, Copy, ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '../../contexts/ToastContext';

export default function WelcomeScreen() {
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  const { name, companyName, joinCode } = location.state || {};

  if (!joinCode) {
    navigate('/dashboard');
    return null;
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(joinCode);
      setCopied(true);
      toast.success('Code copied to clipboard!');
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast.error('Failed to copy code');
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-card welcome-screen">
          <div className="welcome-icon">
            <CheckCircle size={32} />
          </div>

          <h2>Welcome{name ? `, ${name}` : ''}!</h2>
          <p>Your company workspace is ready.</p>

          <div style={{ background: 'var(--gray-50)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)', marginBottom: 'var(--space-6)', textAlign: 'left' }}>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--gray-500)', fontWeight: 500, marginBottom: 4 }}>Company</div>
            <div style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, color: 'var(--gray-900)' }}>{companyName}</div>
          </div>

          <div className="join-code-display">
            <div className="join-code-label">Employee Join Code</div>
            <div className="join-code-value">{joinCode}</div>
            <div className="join-code-hint">
              Share this code only with employees you want to connect to your company.
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <button className="btn btn-secondary btn-block" onClick={handleCopy}>
              <Copy size={16} />
              {copied ? 'Copied!' : 'Copy Code'}
            </button>

            <button className="btn btn-primary btn-block btn-lg" onClick={() => navigate('/dashboard')}>
              Go To Dashboard
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
