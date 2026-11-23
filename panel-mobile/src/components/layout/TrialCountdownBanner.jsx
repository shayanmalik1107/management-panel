import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Clock, Sparkles, ArrowRight, X, ShieldCheck } from 'lucide-react';

export default function TrialCountdownBanner() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  const isCurrentActive = userProfile?.accountStatus === 'active';
  const isTrialActive = isCurrentActive && (
    userProfile?.package?.planId === 'trial' ||
    userProfile?.subscription?.isTrial ||
    userProfile?.subscription?.planId === 'trial'
  );

  const sub = userProfile?.subscription || {};
  const { daysRemaining, hoursRemaining, isExpired } = useMemo(() => {
    if (!isTrialActive) return { daysRemaining: 0, hoursRemaining: 0, isExpired: false };
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const start = sub.startDate || userProfile?.approvedAt || userProfile?.createdAt || now;
    const extra = sub.extraDaysPassed || 0;
    const todayTime = now + (extra * oneDayMs);
    const expTime = sub.expiryDate || (start + 3 * oneDayMs);

    const diffMs = Math.max(0, expTime - todayTime);
    const remDays = Math.ceil(diffMs / oneDayMs);
    const remHours = Math.max(0, Math.ceil(diffMs / (60 * 60 * 1000)));
    const expired = sub.status === 'expired' || todayTime >= expTime || diffMs <= 0;

    return { daysRemaining: remDays, hoursRemaining: remHours, isExpired: expired };
  }, [sub, userProfile, isTrialActive]);

  if (!isTrialActive || dismissed || isExpired) return null;

  return (
    <div style={{
      background: 'linear-gradient(90deg, #1e1b4b 0%, #312e81 35%, #065f46 100%)',
      color: '#ffffff',
      padding: '8px 16px',
      fontSize: 13,
      fontWeight: 500,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      boxShadow: '0 2px 10px rgba(0, 0, 0, 0.15)',
      position: 'relative',
      zIndex: 40,
      flexWrap: 'wrap',
      borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          background: 'rgba(255, 255, 255, 0.18)',
          backdropFilter: 'blur(8px)',
          padding: '3px 10px',
          borderRadius: 20,
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: '0.5px',
          textTransform: 'uppercase',
          border: '1px solid rgba(255, 255, 255, 0.25)',
        }}>
          <Sparkles size={12} color="#facc15" /> Free Trial Active
        </span>

        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, color: '#fef08a' }}>
          <Clock size={14} />
          {daysRemaining > 1 ? `${daysRemaining} Days Left` : `${hoursRemaining} Hours Left`}
        </span>

        <span style={{ color: 'rgba(255, 255, 255, 0.85)', fontSize: 12 }}>
          • Limits: <strong>1 Company</strong> & <strong>Max 3 Staff</strong>. Your business records and inventory are safely preserved!
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          onClick={() => navigate('/billing')}
          style={{
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: '#ffffff',
            border: 'none',
            borderRadius: 8,
            padding: '5px 12px',
            fontSize: 12,
            fontWeight: 800,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            boxShadow: '0 2px 8px rgba(16, 185, 129, 0.4)',
            transition: 'transform 0.15s ease',
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.04)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          Upgrade Plan <ArrowRight size={13} />
        </button>

        <button
          onClick={() => setDismissed(true)}
          title="Dismiss banner"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'rgba(255, 255, 255, 0.7)',
            cursor: 'pointer',
            padding: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 6,
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#ffffff'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)'}
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
