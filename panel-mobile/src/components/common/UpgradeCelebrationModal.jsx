import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Sparkles, Building2, X } from 'lucide-react';

export default function UpgradeCelebrationModal() {
  const { userProfile } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const prevMaxCompRef = useRef(null);

  useEffect(() => {
    if (!userProfile) return;

    const currentMax = userProfile.maxCompanies || userProfile.package?.maxCompanies || 1;

    // Detect if maxCompanies increased while session was active
    if (prevMaxCompRef.current !== null && currentMax > prevMaxCompRef.current) {
      setShowModal(true);
    }

    prevMaxCompRef.current = currentMax;
  }, [userProfile?.maxCompanies, userProfile?.package?.planId]);

  if (!showModal) return null;

  const packageName = userProfile?.package?.name || 'Pro Multi-Company Package';
  const maxCompanies = userProfile?.maxCompanies || 3;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(15, 23, 42, 0.8)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      padding: 20,
      animation: 'fadeIn 0.3s ease',
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: 24,
        padding: 36,
        maxWidth: 460,
        width: '100%',
        textAlign: 'center',
        boxShadow: '0 25px 50px -12px rgba(37, 99, 235, 0.35)',
        position: 'relative',
        border: '2px solid #60a5fa',
      }}>
        <button
          onClick={() => setShowModal(false)}
          style={{
            position: 'absolute',
            right: 16,
            top: 16,
            background: '#f1f5f9',
            border: 'none',
            borderRadius: '50%',
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: '#64748b',
          }}
        >
          <X size={18} />
        </button>

        <div style={{
          width: 72,
          height: 72,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px auto',
          boxShadow: '0 10px 20px rgba(37, 99, 235, 0.3)',
        }}>
          <Sparkles size={36} />
        </div>

        <h2 style={{ fontSize: 24, fontWeight: 900, color: '#0f172a', margin: '0 0 10px 0' }}>
          Plan Upgraded Successfully! 🎉
        </h2>

        <p style={{ fontSize: 15, color: '#475569', lineHeight: 1.6, marginBottom: 24 }}>
          Congratulations! Your account has been upgraded to <strong>{packageName}</strong>. You can now create and manage up to <strong>{maxCompanies} Companies</strong>!
        </p>

        <div style={{
          background: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: 14,
          padding: 16,
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          color: '#1e40af',
          fontSize: 14,
          fontWeight: 700,
        }}>
          <Building2 size={20} /> Unlocked: {maxCompanies} Company Workspaces Available
        </div>

        <button
          onClick={() => setShowModal(false)}
          style={{
            width: '100%',
            padding: '14px 20px',
            borderRadius: 12,
            border: 'none',
            background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
            color: '#ffffff',
            fontSize: 15,
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
          }}
        >
          Awesome! Continue to Workspace
        </button>
      </div>
    </div>
  );
}
