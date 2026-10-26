import { useState, useEffect } from 'react';
import { Mail, KeyRound, ShieldAlert, CheckCircle2, RotateCcw, X, Loader2, Sparkles, Send } from 'lucide-react';
import { startTrialSubscription } from '../../services/authService';
import { useToast } from '../../contexts/ToastContext';

export default function TrialOtpModal({ isOpen, onClose, userProfile, onSuccess }) {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState('email'); // 'email' | 'otp'
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setEmail(userProfile?.email || '');
      setOtp('');
      setStep('email');
      setErrorMsg('');
      setCountdown(0);
    }
  }, [isOpen, userProfile]);

  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  if (!isOpen) return null;

  const handleSendOtp = async (e) => {
    if (e) e.preventDefault();
    setErrorMsg('');

    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      setErrorMsg('Please enter a valid email address (e.g. name@example.com).');
      return;
    }

    // Disposable/Burner email detection
    const domain = cleanEmail.split('@')[1] || '';
    const blockedDomains = [
      'tempmail.com', 'guerrillamail.com', '10minutemail.com', 'mailinator.com',
      'throwawaymail.com', 'yopmail.com', 'getnada.com', 'fakemailgenerator.com',
      'trashmail.com', 'dispostable.com', 'sharklasers.com', 'guerrillamailblock.com',
      'mohmal.com', 'burnermail.io', 'inboxkitten.com', 'nada.ltd', 'crazymailing.com'
    ];
    if (blockedDomains.some(d => domain === d || domain.endsWith('.' + d))) {
      setErrorMsg('Disposable burner email addresses are not permitted for free trials. Please enter your authentic personal or business email (Gmail, Yahoo, Outlook, etc.).');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          uid: userProfile?.uid
        })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to send verification code to your email');
      }

      setStep('otp');
      setCountdown(45);
      toast.success(`Verification code sent to ${cleanEmail}! Check your inbox.`);
    } catch (err) {
      console.error('Send Email OTP error:', err);
      setErrorMsg(err.message || 'Error sending verification code. Please check your email and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    if (e) e.preventDefault();
    setErrorMsg('');

    const cleanOtp = otp.trim();
    if (!cleanOtp || cleanOtp.length < 4) {
      setErrorMsg('Please enter the 6-digit verification code.');
      return;
    }

    setLoading(true);
    try {
      const cleanEmail = email.trim().toLowerCase();
      const response = await fetch('/api/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          otp: cleanOtp,
          uid: userProfile?.uid
        })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Verification failed');
      }

      // Activate trial directly in database without admin approval
      await startTrialSubscription(userProfile.uid, data.email || cleanEmail);

      toast.success('🎉 3-Day Free Trial Activated! Welcome to your workspace.');
      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (err) {
      console.error('Verify Email OTP error:', err);
      setErrorMsg(err.message || 'Invalid verification code. Please check your email and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: 16,
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: 24,
        width: '100%',
        maxWidth: 440,
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        overflow: 'hidden',
        border: '1px solid #e2e8f0',
        animation: 'modalSlideIn 0.2s ease-out',
      }}>
        {/* Header */}
        <div style={{
          padding: '24px 28px 20px',
          background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
          borderBottom: '1px solid #bfdbfe',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: '#2563eb',
              color: '#ffffff',
              fontSize: 11,
              fontWeight: 800,
              padding: '3px 10px',
              borderRadius: 20,
              marginBottom: 8,
              letterSpacing: '0.5px',
            }}>
              <Sparkles size={12} /> INSTANT ACCESS
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: 0 }}>
              Verify Email for 3-Day Trial
            </h3>
            <p style={{ fontSize: 13, color: '#475569', margin: '4px 0 0 0' }}>
              One-time email verification code to start your trial immediately.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#64748b',
              padding: 4,
              borderRadius: 8,
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px 28px' }}>
          {errorMsg && (
            <div style={{
              background: '#fee2e2',
              border: '1px solid #fca5a5',
              borderRadius: 12,
              padding: '12px 16px',
              marginBottom: 20,
              color: '#991b1b',
              fontSize: 13,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              lineHeight: 1.45,
            }}>
              <ShieldAlert size={18} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>{errorMsg}</div>
            </div>
          )}

          {step === 'email' ? (
            <form onSubmit={handleSendOtp}>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 8 }}>
                  Enter Email Address
                </label>
                <div style={{ position: 'relative' }}>
                  <Mail size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoFocus
                    required
                    style={{
                      width: '100%',
                      padding: '12px 14px 12px 42px',
                      borderRadius: 12,
                      border: '1.5px solid #cbd5e1',
                      fontSize: 15,
                      fontWeight: 600,
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}>
                  🔒 Each email address is limited to 1 trial account to prevent abuse.
                </div>
              </div>

              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 12,
                padding: '12px 14px',
                marginBottom: 24,
                fontSize: 12.5,
                color: '#475569',
              }}>
                <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>Included in 3-Day Free Trial:</div>
                • 1 Company Workspace<br />
                • Up to 3 Employee Accounts<br />
                • Full Unlimited Features (Invoicing, Ledgers, Inventory)<br />
                • 100% Data Preservation when upgrading to paid plan
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '14px 20px',
                  borderRadius: 12,
                  border: 'none',
                  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                  color: '#ffffff',
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  boxShadow: '0 4px 14px rgba(37, 99, 235, 0.3)',
                }}
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" /> Sending Verification Code...
                  </>
                ) : (
                  <>
                    <Send size={16} /> Send Verification Code to Email
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp}>
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <label style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>
                    Enter 6-Digit Email Code
                  </label>
                  <button
                    type="button"
                    onClick={() => setStep('email')}
                    style={{ background: 'transparent', border: 'none', color: '#2563eb', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                  >
                    Change Email
                  </button>
                </div>

                <div style={{ position: 'relative' }}>
                  <KeyRound size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="Enter 6-digit code"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    autoFocus
                    required
                    style={{
                      width: '100%',
                      padding: '12px 14px 12px 42px',
                      borderRadius: 12,
                      border: '1.5px solid #cbd5e1',
                      fontSize: 18,
                      fontWeight: 800,
                      letterSpacing: '4px',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, fontSize: 12, color: '#64748b' }}>
                  <span>Code sent to: <strong style={{ color: '#0f172a' }}>{email}</strong></span>
                  {countdown > 0 ? (
                    <span>Resend in {countdown}s</span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#2563eb',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <RotateCcw size={12} /> Resend Code
                    </button>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '14px 20px',
                  borderRadius: 12,
                  border: 'none',
                  background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                  color: '#ffffff',
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  boxShadow: '0 4px 14px rgba(22, 163, 74, 0.3)',
                  marginTop: 20,
                }}
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" /> Verifying...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={18} /> Verify Email & Start 3-Day Free Trial
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
