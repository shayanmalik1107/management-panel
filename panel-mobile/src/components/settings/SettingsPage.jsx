import { Settings, CheckCircle2, ShieldCheck, Building, Key } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export default function SettingsPage() {
  const { companyInfo } = useAuth();

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Company Settings</h1>
          <p className="text-muted text-sm">Manage business settings and system configuration</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-6)' }}>
        {/* Company Preferences Card */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ padding: 10, borderRadius: 10, background: 'var(--primary-50)', color: 'var(--primary-600)' }}>
                <Settings size={22} />
              </div>
              <div>
                <h3 className="card-title" style={{ fontSize: 16, fontWeight: 700 }}>Company Profile</h3>
                <p className="text-muted text-xs" style={{ margin: 0 }}>Workspace: {companyInfo?.name || 'Company'}</p>
              </div>
            </div>
          </div>
          <div className="card-body" style={{ padding: 'var(--space-6)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--gray-50)', borderRadius: 8 }}>
                <span className="text-sm text-muted">Company Name</span>
                <span className="text-sm font-medium">{companyInfo?.name || '—'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--gray-50)', borderRadius: 8 }}>
                <span className="text-sm text-muted">Base Currency</span>
                <span className="text-sm font-medium">{companyInfo?.currency || 'PKR / Rs'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--gray-50)', borderRadius: 8 }}>
                <span className="text-sm text-muted">Company Join Code</span>
                <span className="text-sm font-mono font-medium" style={{ color: 'var(--primary-600)' }}>{companyInfo?.joinCode || 'N/A'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* System Launch Status Card */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ padding: 10, borderRadius: 10, background: 'var(--success-50)', color: 'var(--success-600)' }}>
                <ShieldCheck size={22} />
              </div>
              <div>
                <h3 className="card-title" style={{ fontSize: 16, fontWeight: 700 }}>Launch Readiness</h3>
                <p className="text-muted text-xs" style={{ margin: 0 }}>Production Environment</p>
              </div>
            </div>
          </div>
          <div className="card-body" style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
            <CheckCircle2 size={40} color="var(--success-500)" style={{ margin: '0 auto 12px auto' }} />
            <h4 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Production Ready</h4>
            <p className="text-muted text-sm" style={{ maxWidth: 360, margin: '0 auto' }}>
              Your system is active, live-synchronized, and ready for production operational launch.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

