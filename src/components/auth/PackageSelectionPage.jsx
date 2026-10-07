import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { selectUserPackage, requestPlanUpgrade, logout, calculateProratedUpgrade, schedulePlanDowngrade, cancelScheduledDowngrade } from '../../services/authService';
import { useToast } from '../../contexts/ToastContext';
import { Building2, CheckCircle2, ShieldCheck, Sparkles, LogOut, ArrowRight, ArrowLeft, Clock, MessageCircle, Calendar } from 'lucide-react';
import MaxPlanUpgradeModal from '../common/MaxPlanUpgradeModal';

export default function PackageSelectionPage() {
  const { userProfile, currentUser } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [loadingPlan, setLoadingPlan] = useState(null);
  const [showMaxUpgradeModal, setShowMaxUpgradeModal] = useState(false);

  const isCurrentActive = userProfile?.accountStatus === 'active';
  const currentPlanId = userProfile?.package?.planId || 'basic';
  const isUpgradePending = userProfile?.upgradeRequest?.status === 'pending';

  const isBasicActive = isCurrentActive && currentPlanId === 'basic';
  const isProActive = isCurrentActive && currentPlanId === 'pro';

  const proratedInfo = useMemo(() => {
    if (isBasicActive && userProfile) {
      return calculateProratedUpgrade(userProfile);
    }
    return null;
  }, [isBasicActive, userProfile]);

  const expiryDateFormatted = useMemo(() => {
    const exp = userProfile?.subscription?.expiryDate;
    return exp ? new Date(exp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Next Cycle';
  }, [userProfile?.subscription?.expiryDate]);

  const isScheduledDowngrade = userProfile?.scheduledDowngrade?.status === 'scheduled';

  const handleSelectPackage = async (planId) => {
    if (!userProfile?.uid) return;
    if (isCurrentActive && planId === currentPlanId) return;
    if (isProActive && planId === 'basic') return;

    setLoadingPlan(planId);
    try {
      if (isCurrentActive) {
        // Active user requesting plan upgrade with proration
        await requestPlanUpgrade(userProfile.uid, planId, userProfile);
        toast.success('🚀 Upgrade request submitted! Redirecting to payment instructions...');
        navigate('/payment-pending');
      } else {
        // Initial package selection for new registration
        await selectUserPackage(userProfile.uid, planId);
        toast.success(planId === 'basic' ? 'Basic Package Selected!' : 'Pro Multi-Company Package Selected!');
        navigate('/payment-pending');
      }
    } catch (err) {
      console.error('Error selecting package:', err);
      toast.error('Failed to process request. Please try again.');
      setLoadingPlan(null);
    }
  };

  const handleToggleScheduleDowngrade = async () => {
    if (!userProfile?.uid) return;
    try {
      if (isScheduledDowngrade) {
        await cancelScheduledDowngrade(userProfile.uid);
        toast.success('Cancelled scheduled downgrade to Basic Plan.');
      } else {
        await schedulePlanDowngrade(userProfile.uid, 'basic');
        toast.success(`Scheduled downgrade to Basic Plan on ${expiryDateFormatted}.`);
      }
    } catch (err) {
      toast.error('Failed to update downgrade schedule.');
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
      background: 'linear-gradient(135deg, #f8fafc 0%, #edf2f7 100%)',
      color: '#0f172a',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      paddingBottom: 60,
    }}>
      {/* Top Header */}
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
      <main style={{ maxWidth: 1040, margin: '0 auto', padding: '50px 20px' }}>
        <div style={{ textAlign: 'center', marginBottom: 44 }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 16px',
            borderRadius: 20,
            background: '#dbeafe',
            border: '1px solid #93c5fd',
            color: '#1e40af',
            fontSize: 13,
            fontWeight: 700,
            marginBottom: 16,
          }}>
            <Sparkles size={14} /> Step 1 of 2: Select Business Subscription
          </div>
          <h1 style={{ fontSize: 34, fontWeight: 800, color: '#0f172a', margin: '0 0 12px 0', letterSpacing: '-0.5px' }}>
            Choose the Perfect Plan for Your Business
          </h1>
          <p style={{ fontSize: 16, color: '#64748b', maxWidth: 640, margin: '0 auto' }}>
            Unlock complete inventory, sales, customer ledgers, and employee management. Select a package to proceed to payment verification.
          </p>
        </div>

        {/* Pricing Cards Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 32,
          maxWidth: 900,
          margin: '0 auto',
        }}>
          {/* Basic Package (Rs 5,000) */}
          {(() => {
            const isBasicActive = isCurrentActive && currentPlanId === 'basic';
            return (
              <div style={{
                background: '#ffffff',
                borderRadius: 20,
                border: isBasicActive ? '2px solid #16a34a' : '1px solid #e2e8f0',
                padding: 32,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05)',
                position: 'relative',
                transition: 'all 0.25s ease',
              }}>
                {isBasicActive && (
                  <div style={{
                    position: 'absolute',
                    top: -14,
                    right: 28,
                    background: '#16a34a',
                    color: '#ffffff',
                    fontSize: 12,
                    fontWeight: 800,
                    padding: '4px 16px',
                    borderRadius: 20,
                    letterSpacing: '0.5px',
                    boxShadow: '0 4px 10px rgba(22, 163, 74, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}>
                    <CheckCircle2 size={13} /> CURRENT ACTIVE PLAN
                  </div>
                )}

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Basic Plan
                    </span>
                    <span style={{
                      fontSize: 12,
                      fontWeight: 700,
                      background: '#f1f5f9',
                      color: '#475569',
                      padding: '4px 12px',
                      borderRadius: 20,
                    }}>
                      1 Company
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 24 }}>
                    <span style={{ fontSize: 38, fontWeight: 900, color: '#0f172a' }}>Rs. 5,000</span>
                    <span style={{ fontSize: 14, color: '#64748b', fontWeight: 600 }}>/ month</span>
                  </div>

                  <p style={{ fontSize: 14, color: '#64748b', marginBottom: 24, lineHeight: 1.5 }}>
                    Ideal for single shop owners or small businesses starting out with complete management tools.
                  </p>

                  <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 20, marginBottom: 28 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 14 }}>
                      Included Features:
                    </div>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <li style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#334155' }}>
                        <CheckCircle2 size={18} color="#16a34a" /> <strong>1 Company Workspace</strong>
                      </li>
                      <li style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#334155' }}>
                        <CheckCircle2 size={18} color="#16a34a" /> <strong>Unlimited Products</strong>
                      </li>
                      <li style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#334155' }}>
                        <CheckCircle2 size={18} color="#16a34a" /> <strong>Unlimited Sales & Orders</strong>
                      </li>
                      <li style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#334155' }}>
                        <CheckCircle2 size={18} color="#16a34a" /> <strong>Unlimited Customers & Ledgers</strong>
                      </li>
                      <li style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#334155' }}>
                        <CheckCircle2 size={18} color="#16a34a" /> <strong>Unlimited Employee Accounts</strong>
                      </li>
                      <li style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#334155' }}>
                        <CheckCircle2 size={18} color="#16a34a" /> <strong>PDF Statements & Invoicing</strong>
                      </li>
                    </ul>
                  </div>
                </div>

                <button
                  disabled={loadingPlan !== null || isBasicActive || isProActive}
                  onClick={() => handleSelectPackage('basic')}
                  style={{
                    width: '100%',
                    padding: '14px 20px',
                    borderRadius: 12,
                    border: isBasicActive ? '1px solid #bbf7d0' : isProActive ? '1px solid #e2e8f0' : '1px solid #cbd5e1',
                    background: isBasicActive ? '#f0fdf4' : isProActive ? '#f8fafc' : '#ffffff',
                    color: isBasicActive ? '#166534' : isProActive ? '#94a3b8' : '#0f172a',
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: (isBasicActive || isProActive) ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    transition: 'all 0.2s',
                  }}
                >
                  {isBasicActive ? (
                    <>
                      <CheckCircle2 size={18} color="#16a34a" /> Current Active Plan
                    </>
                  ) : isProActive ? (
                    <>
                      <CheckCircle2 size={18} color="#94a3b8" /> Included in Pro Plan
                    </>
                  ) : loadingPlan === 'basic' ? (
                    <span className="loading-spinner sm" style={{ width: 20, height: 20, borderTopColor: '#2563eb' }} />
                  ) : (
                    <>
                      Select Basic Package <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </div>
            );
          })()}

          {/* Pro / Multi-Company Package (Rs 10,000) */}
          {(() => {
            const isProActive = isCurrentActive && currentPlanId === 'pro';
            return (
              <div style={{
                background: '#ffffff',
                borderRadius: 20,
                border: isProActive ? '2px solid #16a34a' : '2px solid #2563eb',
                padding: 32,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxShadow: '0 20px 35px -10px rgba(37, 99, 235, 0.18)',
                position: 'relative',
                transform: 'scale(1.02)',
              }}>
                {/* Recommended or Current Badge */}
                {isProActive ? (
                  <div style={{
                    position: 'absolute',
                    top: -14,
                    right: 28,
                    background: '#16a34a',
                    color: '#ffffff',
                    fontSize: 12,
                    fontWeight: 800,
                    padding: '4px 16px',
                    borderRadius: 20,
                    letterSpacing: '0.5px',
                    boxShadow: '0 4px 10px rgba(22, 163, 74, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}>
                    <CheckCircle2 size={13} /> CURRENT ACTIVE PLAN
                  </div>
                ) : isUpgradePending ? (
                  <div style={{
                    position: 'absolute',
                    top: -14,
                    right: 28,
                    background: '#d97706',
                    color: '#ffffff',
                    fontSize: 12,
                    fontWeight: 800,
                    padding: '4px 16px',
                    borderRadius: 20,
                    letterSpacing: '0.5px',
                    boxShadow: '0 4px 10px rgba(217, 119, 6, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}>
                    <Clock size={13} /> UPGRADE REQUEST SUBMITTED
                  </div>
                ) : (
                  <div style={{
                    position: 'absolute',
                    top: -14,
                    right: 28,
                    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                    color: '#ffffff',
                    fontSize: 12,
                    fontWeight: 800,
                    padding: '4px 16px',
                    borderRadius: 20,
                    letterSpacing: '0.5px',
                    boxShadow: '0 4px 10px rgba(37, 99, 235, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}>
                    <Sparkles size={13} /> MOST POPULAR
                  </div>
                )}

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Pro Multi-Company Plan
                    </span>
                    <span style={{
                      fontSize: 12,
                      fontWeight: 800,
                      background: '#dbeafe',
                      color: '#1d4ed8',
                      padding: '4px 12px',
                      borderRadius: 20,
                    }}>
                      3 Companies
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 24 }}>
                    <span style={{ fontSize: 38, fontWeight: 900, color: '#0f172a' }}>Rs. 10,000</span>
                    <span style={{ fontSize: 14, color: '#64748b', fontWeight: 600 }}>/ month</span>
                  </div>

                  <p style={{ fontSize: 14, color: '#64748b', marginBottom: 24, lineHeight: 1.5 }}>
                    Designed for business owners managing multiple shop branches or separate company entities.
                  </p>

                  <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 20, marginBottom: 28 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 14 }}>
                      Everything in Basic + Multi-Company Power:
                    </div>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <li style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#0f172a', fontWeight: 700 }}>
                        <CheckCircle2 size={18} color="#2563eb" /> <strong>Up to 3 Companies Workspaces</strong>
                      </li>
                      <li style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#334155' }}>
                        <CheckCircle2 size={18} color="#2563eb" /> <strong>Unlimited Products & Inventory</strong>
                      </li>
                      <li style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#334155' }}>
                        <CheckCircle2 size={18} color="#2563eb" /> <strong>Unlimited Orders & Sales Ledgers</strong>
                      </li>
                      <li style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#334155' }}>
                        <CheckCircle2 size={18} color="#2563eb" /> <strong>Unlimited Customers & Staff Accounts</strong>
                      </li>
                      <li style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#334155' }}>
                        <CheckCircle2 size={18} color="#2563eb" /> <strong>Multi-Store Analytics & Profit Reports</strong>
                      </li>
                      <li style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#334155' }}>
                        <CheckCircle2 size={18} color="#2563eb" /> <strong>Priority Support Assistance</strong>
                      </li>
                    </ul>
                  </div>
                </div>

                <button
                  disabled={loadingPlan !== null || isUpgradePending}
                  onClick={() => {
                    if (isProActive) {
                      setShowMaxUpgradeModal(true);
                    } else {
                      handleSelectPackage('pro');
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '14px 20px',
                    borderRadius: 12,
                    border: isProActive ? '1px solid #bbf7d0' : 'none',
                    background: isProActive
                      ? '#f0fdf4'
                      : isUpgradePending
                      ? '#fef3c7'
                      : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                    color: isProActive
                      ? '#15803d'
                      : isUpgradePending
                      ? '#b45309'
                      : '#ffffff',
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: isUpgradePending ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    boxShadow: isUpgradePending ? 'none' : '0 4px 14px rgba(37, 99, 235, 0.25)',
                    transition: 'all 0.2s',
                  }}
                >
                  {isProActive ? (
                    <>
                      <MessageCircle size={18} color="#16a34a" /> Contact WhatsApp for Further Upgrades
                    </>
                  ) : isUpgradePending ? (
                    <>
                      <Clock size={18} color="#d97706" /> Upgrade Request Pending Review
                    </>
                  ) : loadingPlan === 'pro' ? (
                    <span className="loading-spinner sm" style={{ width: 20, height: 20, borderTopColor: '#ffffff' }} />
                  ) : (
                    <>
                      {isCurrentActive ? 'Request Upgrade to Pro (Rs 10,000)' : 'Select Pro Package (Rs 10,000)'} <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </div>
            );
          })()}
        </div>

        {/* Security & Guarantee Note */}
        <div style={{
          marginTop: 48,
          textAlign: 'center',
          color: '#64748b',
          fontSize: 13,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}>
          <ShieldCheck size={18} color="#16a34a" /> Verified Payment Protocol • Real-time Account Activation • Instant Support
        </div>
      </main>

      <MaxPlanUpgradeModal
        isOpen={showMaxUpgradeModal}
        onClose={() => setShowMaxUpgradeModal(false)}
      />
    </div>
  );
}
