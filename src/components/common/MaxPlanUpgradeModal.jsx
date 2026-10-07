import { MessageCircle, Building2, Sparkles, X, PhoneCall } from 'lucide-react';

export default function MaxPlanUpgradeModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  const whatsappNumber = '923104824942';
  const whatsappMessage = encodeURIComponent(
    'Hello LAMBA Support Team! I have reached my company limit on the Pro Package and would like to inquire about further upgrades and custom company slot packages.'
  );
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${whatsappMessage}`;

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      padding: 20,
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: 24,
        padding: 32,
        maxWidth: 480,
        width: '100%',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        position: 'relative',
        textAlign: 'center',
        border: '1px solid #e2e8f0',
      }}>
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 18,
            right: 18,
            background: '#f1f5f9',
            border: 'none',
            borderRadius: '50%',
            width: 34,
            height: 34,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: '#64748b',
          }}
        >
          <X size={18} />
        </button>

        {/* WhatsApp / Upgrade Icon */}
        <div style={{
          width: 70,
          height: 70,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #25d366 0%, #128c7e 100%)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px auto',
          boxShadow: '0 10px 25px rgba(37, 211, 102, 0.35)',
        }}>
          <MessageCircle size={36} />
        </div>

        {/* Title & Badge */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 14px',
          borderRadius: 20,
          background: '#f0fdf4',
          border: '1px solid #bbf7d0',
          color: '#166534',
          fontSize: 12,
          fontWeight: 800,
          marginBottom: 12,
        }}>
          <Sparkles size={13} /> PRO PACKAGE LIMIT REACHED
        </div>

        <h2 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', margin: '0 0 10px 0', letterSpacing: '-0.5px' }}>
          Need More Company Slots?
        </h2>

        <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.6, margin: '0 0 24px 0' }}>
          You have reached the maximum company slots included in your plan. To add more company slots or customize your subscription, please contact our team on WhatsApp for further upgrades & charges!
        </p>

        {/* Contact Info Box */}
        <div style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: 14,
          padding: 16,
          marginBottom: 24,
          fontSize: 13,
          color: '#334155',
          textAlign: 'left',
        }}>
          <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            <PhoneCall size={15} color="#25d366" /> Official Upgrade Help Desk:
          </div>
          <div style={{ margin: '3px 0' }}>• WhatsApp Support: <strong>03104824942</strong></div>
          <div style={{ margin: '3px 0' }}>• Account Title: <strong>Shayan Malik</strong></div>
          <div style={{ margin: '3px 0' }}>• Response Time: Instant / Real-time Assistance</div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            style={{
              width: '100%',
              padding: '14px 20px',
              borderRadius: 12,
              background: 'linear-gradient(135deg, #25d366 0%, #128c7e 100%)',
              color: '#ffffff',
              fontSize: 15,
              fontWeight: 800,
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow: '0 4px 14px rgba(37, 211, 102, 0.35)',
              boxSizing: 'border-box',
            }}
          >
            <MessageCircle size={18} /> Contact Team on WhatsApp
          </a>

          <button
            onClick={onClose}
            style={{
              width: '100%',
              padding: '12px 20px',
              borderRadius: 12,
              background: 'transparent',
              border: '1px solid #cbd5e1',
              color: '#475569',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
