import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ref, onValue, update } from 'firebase/database';
import { database } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { logout } from '../../services/authService';
import { useToast } from '../../contexts/ToastContext';
import {
  Building2, Clock, CheckCircle2, Copy, Send, Phone,
  Mail, ShieldCheck, LogOut, ArrowLeft, AlertCircle, CreditCard, Sparkles
} from 'lucide-react';

export default function PaymentPendingPage() {
  const { userProfile, currentUser } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [isCopied, setIsCopied] = useState(false);
  const [copiedKey, setCopiedKey] = useState('');

  const isCurrentActive = userProfile?.accountStatus === 'active';
  const req = userProfile?.upgradeRequest;
  const isReqPending = req && req.status === 'pending';

  // Selected package details: show requested upgrade/renewal package if request is pending
  const targetPlanName = isReqPending
    ? (req.requestedPackageName || (req.requestedPlanId === 'pro' ? 'Pro Multi-Company Package' : 'Basic Package'))
    : (userProfile?.package?.name || 'Basic Package');

  const targetPlanPrice = isReqPending
    ? req.requestedPrice
    : (userProfile?.package?.price || 5000);

  const targetMaxCompanies = isReqPending
    ? req.requestedMaxCompanies
    : (userProfile?.package?.maxCompanies || 1);

  const hasRedirectedRef = useRef(false);

  useEffect(() => {
    if (!userProfile?.uid) return;

    // Real-time listener for activation signal from Super Admin Control Panel
    const userRef = ref(database, `users/${userProfile.uid}`);
    const unsub = onValue(userRef, (snap) => {
      if (snap.exists()) {
        const data = snap.val();
        // Initial activation
        if (data.accountStatus === 'active' && userProfile?.accountStatus === 'pending_approval' && !hasRedirectedRef.current) {
          hasRedirectedRef.current = true;
          toast.success('🎉 Account activated! Redirecting to company workspace...');
          navigate('/select-company', { replace: true });
        }
        // Fix Bug 3: Old code checked maxCompanies > 1 which is ALWAYS false for basic renewals (stays at 1)
        // New: detect whenever upgradeRequest is cleared (approved OR rejected), then distinguish via expiry/slots change
        if (
          userProfile?.accountStatus === 'active' &&
          userProfile?.upgradeRequest?.status === 'pending' &&
          !data.upgradeRequest &&
          !hasRedirectedRef.current
        ) {
          hasRedirectedRef.current = true;
          const wasProUpgrade = (data.maxCompanies || 1) > (userProfile?.maxCompanies || 1);
          const wasRenewalApproved = (data.subscription?.expiryDate || 0) > (userProfile?.subscription?.expiryDate || 0);

          if (wasProUpgrade) {
            toast.success('🎉 Pro Upgrade Approved! You now have access to 3 company workspaces.');
          } else if (wasRenewalApproved) {
            toast.success('🎉 Renewal Approved! Your subscription has been extended by 30 days.');
          } else {
            toast.error('❌ Your request was rejected by Control Panel. You can submit a new request from Billing.');
          }
          navigate('/select-company', { replace: true });
        }
      }
    });

    return () => unsub();
  }, [userProfile, navigate]);

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setIsCopied(true);
    toast.success('Copied to clipboard!');
    setTimeout(() => {
      setIsCopied(false);
      setCopiedKey('');
    }, 2000);
  };

  const handleChangePackage = async () => {
    try {
      if (isCurrentActive) {
        navigate('/select-package');
        return;
      }
      await update(ref(database, `users/${userProfile.uid}`), {
        accountStatus: 'select_package',
        package: null,
      });
      navigate('/select-package');
    } catch (err) {
      toast.error('Failed to change package');
    }
  };

  const handleLogout = async () => {
    try {
      sessionStorage.clear();
      await logout();
      navigate('/login');
    } catch (err) {
      toast.error('Logout failed');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
      color: '#0f172a',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      paddingBottom: 60,
    }}>
      {/* Header */}
      <header className="select-company-header" style={{ borderBottom: '1px solid #e2e8f0', background: '#ffffff' }}>
        <div className="select-company-brand" style={{ display: 'flex', alignItems: 'center' }}>
          <img src="/lamba.png" alt="LAMBA" className="lamba-logo-desktop" style={{ height: '36px', maxWidth: '160px', objectFit: 'contain' }} />
          <img src="/lambalogo.png" alt="LAMBA" className="lamba-logo-mobile" style={{ height: '32px', maxWidth: '32px', objectFit: 'contain' }} />
        </div>

        <div className="select-company-user" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {isCurrentActive && (
            <button
              onClick={() => navigate('/select-company')}
              style={{
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                color: '#1d4ed8',
                padding: '8px 16px',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <ArrowLeft size={16} /> Back to Workspace Selector
            </button>
          )}
          <div className="select-company-user-info">
            <div className="select-company-user-name" style={{ fontWeight: 700 }}>{userProfile?.name || 'Admin'}</div>
            <div className="select-company-user-email" style={{ fontSize: 12, color: '#64748b' }}>{currentUser?.email}</div>
          </div>
          <button
            onClick={handleLogout}
            className="select-company-logout-btn"
            title="Sign Out"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <LogOut size={16} /> Logout
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ maxWidth: 860, margin: '40px auto 0 auto', padding: '0 20px' }}>
        {/* Banner for Active Users continuing with Basic Plan */}
        {isCurrentActive && (
          <div style={{
            background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
            border: '1px solid #93c5fd',
            borderRadius: 18,
            padding: 24,
            marginBottom: 28,
            boxShadow: '0 8px 20px -4px rgba(37, 99, 235, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 20,
          }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#1e40af', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles size={18} color="#2563eb" /> You can still manage your business on your Basic Plan!
              </div>
              <div style={{ fontSize: 14, color: '#1e3a8a', lineHeight: 1.5, maxWidth: 540 }}>
                Your current workspace is active. While your request for {targetPlanName} (Rs. {targetPlanPrice.toLocaleString()}) is being verified, you can go back to your workspace selector and continue working without interruptions. You will be automatically notified once approved.
              </div>
            </div>
            <button
              onClick={() => navigate('/select-company')}
              style={{
                background: '#2563eb',
                color: '#ffffff',
                border: 'none',
                padding: '14px 22px',
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 800,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
                transition: 'all 0.2s',
              }}
            >
              <ArrowLeft size={18} /> Continue to Workspace
            </button>
          </div>
        )}

        {/* Status Card Banner */}
        <div style={{
          background: '#ffffff',
          borderRadius: 20,
          border: isCurrentActive ? '1px solid #93c5fd' : '1px solid #fde68a',
          padding: 28,
          marginBottom: 32,
          boxShadow: isCurrentActive ? '0 10px 25px -5px rgba(37, 99, 235, 0.08)' : '0 10px 25px -5px rgba(217, 119, 6, 0.08)',
          display: 'flex',
          alignItems: 'center',
          gap: 20,
        }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: isCurrentActive ? '#dbeafe' : '#fef3c7',
            border: isCurrentActive ? '1px solid #93c5fd' : '1px solid #fcd34d',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: isCurrentActive ? '#2563eb' : '#d97706',
            flexShrink: 0,
          }}>
            <Clock size={28} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: isCurrentActive ? '#1e40af' : '#92400e', margin: 0 }}>
                {isCurrentActive ? `${targetPlanName} Verification Pending` : 'Payment Verification Pending'}
              </h2>
              <span style={{
                fontSize: 11,
                fontWeight: 700,
                background: isCurrentActive ? '#dbeafe' : '#fef3c7',
                color: isCurrentActive ? '#1d4ed8' : '#b45309',
                padding: '3px 10px',
                borderRadius: 12,
                border: isCurrentActive ? '1px solid #bfdbfe' : '1px solid #fde68a',
              }}>
                {isCurrentActive ? 'Payment Verification' : 'Step 2 of 2'}
              </span>
            </div>
            <p style={{ fontSize: 14, color: isCurrentActive ? '#1e3a8a' : '#78350f', margin: 0, lineHeight: 1.5 }}>
              {isCurrentActive
                ? `Send your payment screenshot for ${targetPlanName} (Rs. ${targetPlanPrice.toLocaleString()}). Super Admin will review and activate your request.`
                : 'Your account will be activated within 24 hours after our team verifies your payment screenshot. This page updates in real-time — no need to refresh!'
              }
            </p>
          </div>
        </div>

        {/* Grid: Package Overview & Payment Instructions */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: 24,
        }}>
          {/* Box 1: Selected Package Summary */}
          <div style={{
            background: '#ffffff',
            borderRadius: 18,
            border: '1px solid #e2e8f0',
            padding: 24,
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {isCurrentActive ? 'Target Upgrade Package' : 'Selected Package'}
              </span>
              <button
                onClick={handleChangePackage}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#2563eb',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <ArrowLeft size={13} /> Change Package
              </button>
            </div>

            <div style={{
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: 14,
              padding: 20,
              marginBottom: 20,
            }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1e40af', margin: '0 0 4px 0' }}>
                {targetPlanName}
              </h3>
              <div style={{ fontSize: 26, fontWeight: 900, color: '#0f172a' }}>
                Rs. {targetPlanPrice.toLocaleString()} <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>/ month</span>
              </div>
              <div style={{ fontSize: 13, color: '#1e40af', fontWeight: 600, marginTop: 8 }}>
                Includes {targetMaxCompanies} Company Workspace{targetMaxCompanies > 1 ? 's' : ''} + Unlimited Features
              </div>
            </div>

            <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <CheckCircle2 size={16} color="#16a34a" /> Registered Email: <strong>{currentUser?.email}</strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <CheckCircle2 size={16} color="#16a34a" /> Account Admin Name: <strong>{userProfile?.name}</strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle2 size={16} color="#16a34a" /> Upgrade Verification: <strong>Automatic via Control Panel</strong>
              </div>
            </div>
          </div>

          {/* Box 2: Payment Account Details */}
          <div style={{
            background: '#ffffff',
            borderRadius: 18,
            border: '2px solid #2563eb',
            padding: 24,
            boxShadow: '0 10px 25px -5px rgba(37, 99, 235, 0.12)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <CreditCard size={18} color="#2563eb" />
              <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Official Payment Details
              </h3>
            </div>

            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
              Please transfer <strong>Rs. {targetPlanPrice.toLocaleString()}</strong> to any of the following accounts:
            </p>

            {/* Account Info Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
              {/* Meezan Bank */}
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 12,
                padding: '14px 16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Meezan Bank / Bank Account</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>Title: SHAYAN MALIK</div>
                  <div style={{ fontSize: 13, fontFamily: 'monospace', fontWeight: 700, color: '#2563eb', marginTop: 2 }}>
                    Acc: 02450112236242
                  </div>
                  <div style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 700, color: '#475569', marginTop: 2 }}>
                    IBAN: PK10MEZN0002450112236242
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <button
                    onClick={() => copyToClipboard('02450112236242', 'meezan_acc')}
                    style={{
                      background: copiedKey === 'meezan_acc' ? '#dcfce7' : '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: 8,
                      padding: '4px 10px',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <Copy size={12} /> {copiedKey === 'meezan_acc' ? 'Copied Acc' : 'Copy Acc'}
                  </button>
                  <button
                    onClick={() => copyToClipboard('PK10MEZN0002450112236242', 'meezan_iban')}
                    style={{
                      background: copiedKey === 'meezan_iban' ? '#dcfce7' : '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: 8,
                      padding: '4px 10px',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <Copy size={12} /> {copiedKey === 'meezan_iban' ? 'Copied IBAN' : 'Copy IBAN'}
                  </button>
                </div>
              </div>

              {/* JazzCash / EasyPaisa */}
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 12,
                padding: '14px 16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>JazzCash</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>Title: Shayan Malik</div>
                  <div style={{ fontSize: 13, fontFamily: 'monospace', fontWeight: 700, color: '#16a34a', marginTop: 2 }}>
                    Account No: 03104824942
                  </div>
                </div>
                <button
                  onClick={() => copyToClipboard('03104824942', 'jazz')}
                  style={{
                    background: copiedKey === 'jazz' ? '#dcfce7' : '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: 8,
                    padding: '6px 12px',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Copy size={13} /> {copiedKey === 'jazz' ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Instruction Step Banner */}
            <div style={{
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: 12,
              padding: 16,
            }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#166534', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Send size={15} /> How to send payment screenshot:
              </div>
              <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#14532d', lineHeight: 1.5 }}>
                <li>Take a clear screenshot of the payment receipt.</li>
                <li>Send screenshot + registered email (<strong>{currentUser?.email}</strong>) to WhatsApp: <strong>03104824942 (+92 310 4824942)</strong> or Email: <strong>payments@lamba.com</strong></li>
                <li>Our control panel team will verify and upgrade your plan within 24h.</li>
              </ol>
            </div>
          </div>
        </div>

        {/* Help Note Footer */}
        <div style={{
          marginTop: 36,
          textAlign: 'center',
          fontSize: 13,
          color: '#64748b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
        }}>
          <ShieldCheck size={16} color="#2563eb" /> Need instant help? Contact WhatsApp Support at <strong>03104824942 (+92 310 4824942)</strong>
        </div>
      </main>
    </div>
  );
}
