import { useState } from 'react';
import { Settings, Database, Loader2, CheckCircle2, Sparkles } from 'lucide-react';
import { seedTestData } from '../../services/seedService';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';

export default function SettingsPage() {
  const { companyId, companyInfo } = useAuth();
  const toast = useToast();
  const [seeding, setSeeding] = useState(false);
  const [seedProgress, setSeedProgress] = useState('');

  const handleSeedData = async () => {
    if (!window.confirm('Generate 1,000 Orders, 100 Shops, and 100 Products for performance testing?')) {
      return;
    }

    setSeeding(true);
    try {
      await seedTestData(companyId, (status) => {
        setSeedProgress(status);
      });
      toast.success('Successfully generated 1,000 Orders, 100 Shops, and 100 Products!');
    } catch (err) {
      console.error('Seeding error:', err);
      toast.error('Failed to generate test data: ' + err.message);
    } finally {
      setSeeding(false);
      setSeedProgress('');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Company Settings & Developer Tools</h1>
          <p className="text-muted text-sm">Manage business settings and generate test performance data</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-6)' }}>
        {/* Performance Testing Seeder Card */}
        <div className="card" style={{ border: '2px solid var(--primary-200)', background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)' }}>
          <div className="card-header" style={{ borderBottom: '1px solid var(--gray-200)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ padding: 10, borderRadius: 10, background: 'var(--primary-50)', color: 'var(--primary-600)' }}>
                <Database size={22} />
              </div>
              <div>
                <h3 className="card-title" style={{ fontSize: 16, fontWeight: 700 }}>FlatList Performance Test Seeder</h3>
                <p className="text-muted text-xs" style={{ margin: 0 }}>Generate large dataset (1,000 Orders, 100 Shops, 100 Products)</p>
              </div>
            </div>
          </div>

          <div className="card-body">
            <p className="text-sm text-muted" style={{ marginBottom: 'var(--space-4)', lineHeight: 1.6 }}>
              Click below to seed <strong>1,000 realistic orders</strong>, <strong>100 customer shops</strong>, and <strong>100 products</strong> into your company workspace. Test FlatList virtual scrolling performance at scale!
            </p>

            {seeding && (
              <div style={{
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: 8,
                padding: '12px 16px',
                marginBottom: 16,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                color: '#1d4ed8',
                fontSize: 13,
                fontWeight: 600,
              }}>
                <Loader2 size={18} className="animate-spin" />
                <span>{seedProgress || 'Seeding data...'}</span>
              </div>
            )}

            <button
              className="btn btn-primary btn-lg btn-block"
              onClick={handleSeedData}
              disabled={seeding}
              style={{
                background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
                boxShadow: '0 4px 14px rgba(79, 70, 229, 0.3)',
                fontWeight: 700,
              }}
            >
              {seeding ? (
                <>
                  <Loader2 size={18} className="animate-spin" /> Seeding 1,200 Records...
                </>
              ) : (
                <>
                  <Sparkles size={18} /> Generate 1,000 Orders, 100 Shops & 100 Products
                </>
              )}
            </button>
          </div>
        </div>

        {/* Company Settings Card */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ padding: 10, borderRadius: 10, background: 'var(--gray-100)', color: 'var(--gray-700)' }}>
                <Settings size={22} />
              </div>
              <div>
                <h3 className="card-title" style={{ fontSize: 16, fontWeight: 700 }}>Company Preferences</h3>
                <p className="text-muted text-xs" style={{ margin: 0 }}>Company Name: {companyInfo?.name || 'Company'}</p>
              </div>
            </div>
          </div>
          <div className="card-body" style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
            <CheckCircle2 size={36} color="var(--success-500)" style={{ margin: '0 auto 12px auto' }} />
            <h4 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>System Active & Synchronized</h4>
            <p className="text-muted text-sm">Currency: {companyInfo?.currency || 'Rs'} | Join Code: {companyInfo?.joinCode || 'N/A'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
