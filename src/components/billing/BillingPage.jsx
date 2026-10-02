import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import {
  requestPlanUpgrade,
  calculateProratedUpgrade,
  schedulePlanDowngrade,
  cancelScheduledDowngrade
} from '../../services/authService';
import {
  CreditCard, Sparkles, CheckCircle2, Clock, Calendar,
  ArrowRight, ShieldCheck, MessageCircle, Building2, AlertCircle, RefreshCw, Lock
} from 'lucide-react';
import MaxPlanUpgradeModal from '../common/MaxPlanUpgradeModal';

export default function BillingPage() {
  const { userProfile, currentUser } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [loading, setLoading] = useState(false);
  const [showMaxUpgradeModal, setShowMaxUpgradeModal] = useState(false);

  const isCurrentActive = userProfile?.accountStatus === 'active';
  const currentPlanId = userProfile?.package?.planId || 'basic';
  const isBasicActive = isCurrentActive && currentPlanId === 'basic';
  const isProActive = isCurrentActive && currentPlanId === 'pro';

  const isAnyRequestPending = userProfile?.upgradeRequest?.status === 'pending';
  const pendingPlanId = isAnyRequestPending ? userProfile?.upgradeRequest?.requestedPlanId : null;
  const isBasicPending = pendingPlanId === 'basic';
  const isProPending = pendingPlanId === 'pro';
  const isScheduledDowngrade = userProfile?.scheduledDowngrade?.status === 'scheduled';

  const proratedInfo = useMemo(() => {
    if (isBasicActive && userProfile) {
      return calculateProratedUpgrade(userProfile);
    }
    return null;
  }, [isBasicActive, userProfile]);

  const sub = userProfile?.subscription || {};
  const startDateStr = sub.startDate ? new Date(sub.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A';
  const expiryDateStr = sub.expiryDate ? new Date(sub.expiryDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A';

  const { currentDay, daysRemaining, isExpired } = useMemo(() => {
    if (!sub.startDate && !sub.expiryDate) {
      return { currentDay: 1, daysRemaining: 30, isExpired: false };
    }
    const now = Date.now();
    const realElapsedDays = sub.startDate ? Math.max(0, Math.floor((now - sub.startDate) / (1000 * 60 * 60 * 24))) : 0;
    const totalDaysPassed = realElapsedDays + (sub.extraDaysPassed || 0);
    const currDay = Math.min(30, totalDaysPassed + 1);
    const remDays = sub.expiryDate
      ? Math.max(0, Math.ceil((sub.expiryDate - now) / (1000 * 60 * 60 * 24)) - (sub.extraDaysPassed || 0))
      : Math.max(0, 30 - totalDaysPassed);
    const expired = sub.status === 'expired' || remDays <= 0 || (sub.expiryDate && (now + ((sub.extraDaysPassed || 0) * 86400000)) >= sub.expiryDate);
    return { currentDay: currDay, daysRemaining: remDays, isExpired: expired };
  }, [sub]);

  const maxComp = userProfile?.maxCompanies || userProfile?.package?.maxCompanies || 1;

  const handleRequestProUpgrade = async () => {
    if (!userProfile?.uid) return;
    setLoading(true);
    try {
      await requestPlanUpgrade(userProfile.uid, 'pro', userProfile);
      toast.success('🚀 Upgrade request submitted! Redirecting to payment screenshot instructions...');
      navigate('/payment-pending');
    } catch (err) {
      console.error('Failed to request upgrade:', err);
      toast.error('Failed to submit upgrade request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleScheduleDowngrade = async () => {
    if (!userProfile?.uid) return;
    setLoading(true);
    try {
      if (isScheduledDowngrade) {
        await cancelScheduledDowngrade(userProfile.uid);
        toast.success('Cancelled scheduled downgrade to Basic Plan.');
      } else {
        await schedulePlanDowngrade(userProfile.uid, 'basic');
        toast.success(`Scheduled downgrade to Basic Plan on ${expiryDateStr}.`);
      }
    } catch (err) {
      toast.error('Failed to update downgrade schedule.');
    } finally {
      setLoading(false);
    }
  };

  const handleRenewBasicPlan = async () => {
    if (!userProfile?.uid) return;
    setLoading(true);
    try {
      await requestPlanUpgrade(userProfile.uid, 'basic', userProfile);
      toast.success('🚀 Renewal request submitted! Redirecting to payment screenshot instructions...');
      navigate('/payment-pending');
    } catch (err) {
      console.error('Failed to request renewal:', err);
      toast.error('Failed to submit renewal request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Fix Bug 4: handleRenewPlan was referenced on Pro card but was never defined
  const handleRenewPlan = async (planId) => {
    if (!userProfile?.uid) return;
    setLoading(true);
    try {
      await requestPlanUpgrade(userProfile.uid, planId, userProfile);
      const planLabel = planId === 'pro' ? 'Pro Plan' : 'Basic Plan';
      toast.success(`🚀 ${planLabel} renewal request submitted! Redirecting to payment instructions...`);
      navigate('/payment-pending');
    } catch (err) {
      console.error('Failed to request plan renewal:', err);
      toast.error('Failed to submit renewal request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1080, margin: '0 auto' }}>
      {/* Header Banner */}
      <div style={{
        background: '#ffffff',
        borderRadius: 20,
        border: '1px solid #e2e8f0',
        padding: '24px 28px',
        marginBottom: 28,
        boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 16,
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#2563eb', fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
            <CreditCard size={18} /> ACCOUNT SUBSCRIPTION & BILLING
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.5px' }}>
            Subscription Plan & Billing Overview
          </h1>
          <p style={{ fontSize: 14, color: '#64748b', margin: '4px 0 0 0' }}>
            Manage active company slots, subscription expiry countdown, and mid-month plan upgrades.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            color: '#166534',
            padding: '8px 16px',
            borderRadius: 12,
            fontSize: 13,
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <CheckCircle2 size={16} color="#16a34a" /> Account Active
          </div>
        </div>
      </div>

      {/* Grid: 3 Summary Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 20,
        marginBottom: 32,
      }}>
        {/* Card 1: Current Active Plan */}
        <div style={{
          background: '#ffffff',
          borderRadius: 18,
          border: '1px solid #e2e8f0',
          padding: 24,
          boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.5px' }}>
            Active Subscription Plan
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', marginBottom: 4 }}>
            {userProfile?.package?.name || (isProActive ? 'Pro Multi-Company Package' : 'Basic Package')}
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#2563eb' }}>
            Rs. {(userProfile?.package?.price || (isProActive ? 10000 : 5000)).toLocaleString()} / month
          </div>
          <div style={{ borderTop: '1px solid #f1f5f9', marginTop: 16, paddingTop: 12, fontSize: 13, color: '#475569', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Building2 size={15} color="#6366f1" /> Allowed Workspaces: <strong>{maxComp} Slot{maxComp > 1 ? 's' : ''}</strong>
          </div>
        </div>

        {/* Card 2: Subscription Expiry Countdown */}
        <div style={{
          background: '#ffffff',
          borderRadius: 18,
          border: '1px solid #e2e8f0',
          padding: 24,
          boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.5px' }}>
            Days Remaining
          </div>
          <div style={{ fontSize: 32, fontWeight: 900, color: daysRemaining < 5 ? '#dc2626' : '#16a34a', display: 'flex', alignItems: 'baseline', gap: 6 }}>
            {daysRemaining} <span style={{ fontSize: 14, color: '#64748b', fontWeight: 600 }}>Days Left</span>
          </div>
          <div style={{ borderTop: '1px solid #f1f5f9', marginTop: 12, paddingTop: 12, fontSize: 12, color: '#475569', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div>Current Progress: <strong style={{ color: '#2563eb' }}>Day {currentDay} of 30</strong></div>
            <div>Started: <strong>{startDateStr}</strong></div>
            <div>Expires On: <strong style={{ color: '#0f172a' }}>{expiryDateStr}</strong></div>
          </div>
        </div>

        {/* Card 3: System Status */}
        <div style={{
          background: '#ffffff',
          borderRadius: 18,
          border: '1px solid #e2e8f0',
          padding: 24,
          boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.5px' }}>
            Renewal & Auto-Sync
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>
            Control Panel Verified
          </div>
          <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>
            Your account expiry is aligned with Control Panel. When payment is verified, 30 days are extended automatically.
          </div>
        </div>
      </div>

      {/* Scheduled Downgrade Notice if active */}
      {isScheduledDowngrade && (
        <div style={{
          background: '#fef3c7',
          border: '1px solid #fcd34d',
          borderRadius: 16,
          padding: 20,
          marginBottom: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Calendar size={22} color="#b45309" />
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#78350f' }}>
                🗓️ Scheduled Downgrade to Basic Plan
              </div>
              <div style={{ fontSize: 13, color: '#92400e' }}>
                Your plan is scheduled to switch to Basic (Rs. 5,000 / mo) when your current Pro cycle ends on <strong>{expiryDateStr}</strong>.
              </div>
            </div>
          </div>
          <button
            onClick={handleToggleScheduleDowngrade}
            style={{
              background: '#ffffff',
              color: '#b45309',
              border: '1px solid #fcd34d',
              padding: '8px 16px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Cancel Scheduled Downgrade
          </button>
        </div>
      )}

      {/* Plans & Upgrades Section */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginBottom: 16 }}>
          Subscription Package Options
        </h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 24,
        }}>
          {/* Basic Plan Card */}
          <div style={{
            background: '#ffffff',
            borderRadius: 20,
            border: isBasicActive ? '2px solid #16a34a' : '1px solid #e2e8f0',
            padding: 28,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
            opacity: isProActive ? 0.85 : 1,
          }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Basic Plan</span>
                <span style={{ fontSize: 12, fontWeight: 700, background: '#f1f5f9', color: '#475569', padding: '3px 10px', borderRadius: 20 }}>1 Company</span>
              </div>
              <div style={{ fontSize: 32, fontWeight: 900, color: '#0f172a', marginBottom: 12 }}>
                Rs. 5,000 <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>/ month</span>
              </div>
              <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20, lineHeight: 1.5 }}>
                Ideal for single shop owners or small businesses with complete management tools.
              </p>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, color: '#334155', marginBottom: 24 }}>
                <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}><CheckCircle2 size={16} color="#16a34a" /> 1 Company Workspace</li>
                <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}><CheckCircle2 size={16} color="#16a34a" /> Unlimited Products & Sales</li>
                <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}><CheckCircle2 size={16} color="#16a34a" /> Unlimited Customer Ledgers</li>
                <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}><CheckCircle2 size={16} color="#16a34a" /> Unlimited Staff Accounts</li>
              </ul>
            </div>

            {isBasicActive ? (
              daysRemaining <= 4 ? (
                isBasicPending ? (
                  <button disabled style={{ width: '100%', padding: '12px', borderRadius: 10, border: 'none', background: '#fef3c7', color: '#b45309', fontWeight: 800, cursor: 'not-allowed' }}>
                    <Clock size={16} style={{ display: 'inline', marginRight: 6 }} /> Renewal Request Pending Review
                  </button>
                ) : isProPending ? (
                  <button disabled style={{ width: '100%', padding: '12px', borderRadius: 10, border: '1px solid #fed7aa', background: '#fff7ed', color: '#c2410c', fontSize: 12, fontWeight: 700, cursor: 'not-allowed' }}>
                    <Lock size={15} style={{ display: 'inline', marginRight: 6 }} /> Pro Upgrade Request Under Review
                  </button>
                ) : (
                  <button
                    disabled={loading}
                    onClick={handleRenewBasicPlan}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: 10,
                      border: 'none',
                      background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                      color: '#ffffff',
                      fontSize: 14,
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      boxShadow: '0 4px 12px rgba(22, 163, 74, 0.3)',
                    }}
                  >
                    <RefreshCw size={16} /> Renew Basic Plan (Rs. 5,000)
                  </button>
                )
              ) : (
                <button disabled style={{ width: '100%', padding: '12px', borderRadius: 10, border: '1px solid #bbf7d0', background: '#f0fdf4', color: '#166534', fontWeight: 700, cursor: 'not-allowed' }}>
                  <CheckCircle2 size={16} style={{ display: 'inline', marginRight: 6 }} /> Current Active Plan
                </button>
              )
            ) : isProActive ? (
              <div>
                <button
                  onClick={handleToggleScheduleDowngrade}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: 10,
                    border: '1px solid #cbd5e1',
                    background: isScheduledDowngrade ? '#fef3c7' : '#ffffff',
                    color: isScheduledDowngrade ? '#b45309' : '#334155',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {isScheduledDowngrade ? 'Cancel Scheduled Downgrade' : `Schedule Downgrade on ${expiryDateStr}`}
                </button>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 6, textAlign: 'center' }}>
                  Mid-month immediate downgrade is not allowed. Change takes effect on renewal date.
                </div>
              </div>
            ) : null}
          </div>

          {/* Pro Multi-Company Plan Card */}
          <div style={{
            background: '#ffffff',
            borderRadius: 20,
            border: isProActive ? '2px solid #16a34a' : '2px solid #2563eb',
            padding: 28,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 10px 25px -5px rgba(37, 99, 235, 0.15)',
          }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#2563eb', textTransform: 'uppercase' }}>Pro Multi-Company Plan</span>
                <span style={{ fontSize: 12, fontWeight: 800, background: '#dbeafe', color: '#1d4ed8', padding: '3px 10px', borderRadius: 20 }}>3 Companies</span>
              </div>
              <div style={{ fontSize: 32, fontWeight: 900, color: '#0f172a', marginBottom: 4 }}>
                Rs. 10,000 <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>/ month</span>
              </div>

              {/* Prorated Discount Calculation display if upgrading from Basic */}
              {isBasicActive && proratedInfo && proratedInfo.isProrated && (
                <div style={{
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: 12,
                  padding: 12,
                  margin: '12px 0 16px 0',
                  fontSize: 12,
                }}>
                  <div style={{ fontWeight: 800, color: '#166534', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Sparkles size={14} /> Mid-Month Upgrade Discount Applied!
                  </div>
                  <div style={{ color: '#15803d' }}>
                    Unused Basic Credit ({proratedInfo.remainingDays} days left): <strong>-Rs. {proratedInfo.unusedBasicCredit.toLocaleString()}</strong>
                  </div>
                  <div style={{ color: '#0f172a', fontWeight: 800, marginTop: 4 }}>
                    Amount to Pay Now: <span style={{ color: '#2563eb', fontSize: 14 }}>Rs. {proratedInfo.proratedCharge.toLocaleString()}</span>
                  </div>
                </div>
              )}

              <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20, lineHeight: 1.5 }}>
                Designed for owners managing multiple shop branches or separate company entities.
              </p>

              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, color: '#334155', marginBottom: 24 }}>
                <li style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: '#0f172a' }}><CheckCircle2 size={16} color="#2563eb" /> Up to 3 Company Workspaces</li>
                <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}><CheckCircle2 size={16} color="#2563eb" /> Unlimited Products & Inventory</li>
                <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}><CheckCircle2 size={16} color="#2563eb" /> Unlimited Orders & Ledgers</li>
                <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}><CheckCircle2 size={16} color="#2563eb" /> Multi-Store Profit Analytics</li>
              </ul>
            </div>

            {isProActive ? (
              daysRemaining <= 4 ? (
                isAnyRequestPending ? (
                  <button disabled style={{ width: '100%', padding: '14px', borderRadius: 10, border: 'none', background: '#fef3c7', color: '#b45309', fontWeight: 800, cursor: 'not-allowed' }}>
                    <Clock size={16} style={{ display: 'inline', marginRight: 6 }} /> Renewal Request Pending Review
                  </button>
                ) : (
                  <button
                    disabled={loading}
                    onClick={() => handleRenewPlan('pro')}
                    style={{
                      width: '100%',
                      padding: '14px',
                      borderRadius: 10,
                      border: 'none',
                      background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                      color: '#ffffff',
                      fontSize: 14,
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      boxShadow: '0 4px 14px rgba(22, 163, 74, 0.3)',
                    }}
                  >
                    <RefreshCw size={18} /> Renew Pro Plan (Rs. 10,000)
                  </button>
                )
              ) : (
                <button
                  onClick={() => setShowMaxUpgradeModal(true)}
                  style={{
                    width: '100%',
                    padding: '14px',
                    borderRadius: 10,
                    border: '1px solid #bbf7d0',
                    background: '#f0fdf4',
                    color: '#15803d',
                    fontSize: 14,
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  <MessageCircle size={18} /> Contact WhatsApp for Further Upgrades
                </button>
              )
            ) : isProPending ? (
              <button disabled style={{ width: '100%', padding: '14px', borderRadius: 10, border: 'none', background: '#fef3c7', color: '#b45309', fontWeight: 800, cursor: 'not-allowed' }}>
                <Clock size={16} style={{ display: 'inline', marginRight: 6 }} /> Upgrade Request Pending Review
              </button>
            ) : isBasicPending ? (
              <div style={{ textAlign: 'center' }}>
                <button disabled style={{ width: '100%', padding: '12px', borderRadius: 10, border: '1px solid #fed7aa', background: '#fff7ed', color: '#c2410c', fontSize: 13, fontWeight: 800, cursor: 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <Lock size={15} /> Basic Renewal Request Under Review
                </button>
                <div style={{ fontSize: 11, color: '#9a3412', marginTop: 6, lineHeight: 1.4, fontWeight: 600 }}>
                  A Basic Renewal request is currently in review. After approval or rejection by Control Panel, you can request a Pro upgrade.
                </div>
              </div>
            ) : (
              <button
                disabled={loading}
                onClick={handleRequestProUpgrade}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: 10,
                  border: 'none',
                  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                  color: '#ffffff',
                  fontSize: 15,
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  boxShadow: '0 4px 14px rgba(37, 99, 235, 0.3)',
                }}
              >
                {proratedInfo && proratedInfo.isProrated ? (
                  <>Request Upgrade to Pro (Rs. {proratedInfo.proratedCharge.toLocaleString()}) <ArrowRight size={16} /></>
                ) : (
                  <>Request Upgrade to Pro (Rs. 10,000) <ArrowRight size={16} /></>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      <MaxPlanUpgradeModal
        isOpen={showMaxUpgradeModal}
        onClose={() => setShowMaxUpgradeModal(false)}
      />
    </div>
  );
}
