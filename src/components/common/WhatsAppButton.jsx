import React from 'react';

export function WhatsAppIcon({ size = 20, className = '', color = 'currentColor' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0 }}
    >
      <path d="M20.52 3.48A11.93 11.93 0 0012.06 0C5.46 0 .09 5.37.09 11.97c0 2.11.55 4.17 1.6 6L0 24l6.19-1.62a11.94 11.94 0 005.87 1.51h.01c6.6 0 11.97-5.37 11.97-11.97 0-3.2-1.25-6.21-3.52-8.44zM12.06 21.89h-.01a9.92 9.92 0 01-5.06-1.39l-.36-.21-3.76.99 1-3.66-.23-.38a9.93 9.93 0 01-1.52-5.27c0-5.5 4.47-9.97 9.98-9.97 2.66 0 5.16 1.04 7.04 2.92a9.9 9.9 0 012.92 7.05c0 5.5-4.48 9.97-9.98 9.97zm5.47-7.47c-.3-.15-1.78-.88-2.05-.98-.28-.1-.48-.15-.68.15-.2.3-.78.98-.95 1.18-.18.2-.35.23-.65.08-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.18-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.38-.03-.53-.07-.15-.68-1.63-.93-2.23-.24-.58-.49-.5-.68-.51h-.58c-.2 0-.53.08-.8.38-.28.3-1.05 1.03-1.05 2.51s1.08 2.91 1.23 3.11c.15.2 2.12 3.24 5.14 4.54.72.31 1.28.5 1.72.64.72.23 1.38.2 1.9.12.58-.09 1.78-.73 2.03-1.43.25-.7.25-1.31.18-1.43-.08-.13-.28-.2-.58-.35z" />
    </svg>
  );
}

export default function WhatsAppButton({
  phoneNumber = '03104824942',
  variant = 'sidebar', // 'sidebar' | 'header' | 'compact'
  collapsed = false,
  label = 'WhatsApp Support',
  subLabel = '03104824942',
  userRole = '',
  className = '',
  style = {}
}) {
  // Format international number (Pakistan 03xx -> 923xx)
  const cleanNumber = phoneNumber.replace(/\D/g, '');
  const intlNumber = cleanNumber.startsWith('0') ? '92' + cleanNumber.slice(1) : cleanNumber.startsWith('92') ? cleanNumber : '92' + cleanNumber;
  
  const queryMsg = encodeURIComponent(
    `Hello LAMBA Support, I have a query regarding my ${userRole ? `${userRole} ` : ''}dashboard.`
  );
  const waUrl = `https://wa.me/${intlNumber}?text=${queryMsg}`;

  if (variant === 'sidebar') {
    if (collapsed) {
      return (
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          title={`WhatsApp Support (${phoneNumber})`}
          className={`sidebar-whatsapp-btn-collapsed ${className}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
            color: '#ffffff',
            boxShadow: '0 4px 10px rgba(37, 211, 102, 0.35)',
            textDecoration: 'none',
            margin: '0 auto',
            transition: 'all 0.2s ease',
            ...style
          }}
        >
          <WhatsAppIcon size={20} color="#ffffff" />
        </a>
      );
    }

    return (
      <a
        href={waUrl}
        target="_blank"
        rel="noopener noreferrer"
        title={`Click to chat on WhatsApp: ${phoneNumber}`}
        className={`sidebar-whatsapp-btn ${className}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '10px 14px',
          borderRadius: '12px',
          background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
          color: '#ffffff',
          textDecoration: 'none',
          boxShadow: '0 4px 14px rgba(37, 211, 102, 0.3)',
          transition: 'all 0.2s ease',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          cursor: 'pointer',
          ...style
        }}
      >
        <div style={{
          background: 'rgba(255, 255, 255, 0.2)',
          borderRadius: '8px',
          padding: '6px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <WhatsAppIcon size={20} color="#ffffff" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
          <div style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.2px' }}>
            {label}
          </div>
          <div style={{ fontSize: '11px', opacity: 0.92, fontWeight: 500 }}>
            {subLabel}
          </div>
        </div>
      </a>
    );
  }

  // Header / Top Action button variant
  return (
    <a
      href={waUrl}
      target="_blank"
      rel="noopener noreferrer"
      title={`Chat on WhatsApp (${phoneNumber}) for queries`}
      className={`btn-whatsapp-query ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 14px',
        borderRadius: '8px',
        background: '#25D366',
        color: '#ffffff',
        fontWeight: 600,
        fontSize: '13px',
        textDecoration: 'none',
        boxShadow: '0 2px 8px rgba(37, 211, 102, 0.25)',
        transition: 'all 0.2s ease',
        cursor: 'pointer',
        ...style
      }}
    >
      <WhatsAppIcon size={18} color="#ffffff" />
      <span>WhatsApp Queries</span>
    </a>
  );
}
