import React, { useState } from 'react';
import { Monitor, Smartphone, Download, Check, Share, PlusSquare, ArrowRight, X, Sparkles, ShieldCheck, Zap, HardDrive } from 'lucide-react';
import { useOffline } from '../../contexts/OfflineContext';

export default function InstallAppModal({ isOpen, onClose }) {
  const { canInstall, isAppInstalled, installApp } = useOffline();
  const [activeTab, setActiveTab] = useState('desktop'); // 'desktop' | 'mobile'
  const [installedSuccess, setInstalledSuccess] = useState(false);

  if (!isOpen) return null;

  const handleInstallClick = async () => {
    const success = await installApp();
    if (success) {
      setInstalledSuccess(true);
      setTimeout(() => {
        onClose();
        setInstalledSuccess(false);
      }, 2500);
    }
  };

  return (
    <div 
      className="modal-overlay" 
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '16px',
      }}
    >
      <div 
        className="modal-container"
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--color-bg-surface, #ffffff)',
          color: 'var(--color-text-primary, #1e293b)',
          borderRadius: '20px',
          maxWidth: '560px',
          width: '100%',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          border: '1px solid var(--color-border, #e2e8f0)',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '24px 28px 20px',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          color: '#ffffff',
          position: 'relative',
        }}>
          <button 
            type="button" 
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={18} />
          </button>

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '9999px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', fontSize: '12px', fontWeight: 600, marginBottom: '12px' }}>
            <Sparkles size={14} /> Standalone Native App & Offline Engine
          </div>

          <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.5px' }}>
            Install LAMBA Management App
          </h2>
          <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#94a3b8', lineHeight: 1.5 }}>
            Download to your Desktop (Mac / Windows) or Mobile (Android / iPhone) for 100% offline access and fast native speed.
          </p>

          {/* Device Tabs */}
          <div style={{
            display: 'flex',
            gap: '8px',
            marginTop: '20px',
            background: 'rgba(255, 255, 255, 0.08)',
            padding: '4px',
            borderRadius: '12px',
          }}>
            <button
              type="button"
              onClick={() => setActiveTab('desktop')}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '8px 14px',
                borderRadius: '8px',
                border: 'none',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                background: activeTab === 'desktop' ? '#ffffff' : 'transparent',
                color: activeTab === 'desktop' ? '#0f172a' : '#94a3b8',
              }}
            >
              <Monitor size={16} /> Desktop App (Mac / Win)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('mobile')}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '8px 14px',
                borderRadius: '8px',
                border: 'none',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                background: activeTab === 'mobile' ? '#ffffff' : 'transparent',
                color: activeTab === 'mobile' ? '#0f172a' : '#94a3b8',
              }}
            >
              <Smartphone size={16} /> Mobile App (iOS / Android)
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div style={{ padding: '24px 28px' }}>
          {activeTab === 'desktop' ? (
            <div>
              {/* Feature Pill Row */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '10px',
                marginBottom: '20px',
              }}>
                <div style={{ textAlign: 'center', padding: '12px 8px', borderRadius: '10px', backgroundColor: 'var(--color-bg-secondary, #f8fafc)', border: '1px solid var(--color-border, #e2e8f0)' }}>
                  <Zap size={20} color="#0284c7" style={{ margin: '0 auto 4px', display: 'block' }} />
                  <div style={{ fontSize: '11px', fontWeight: 700 }}>Instant Boot</div>
                  <div style={{ fontSize: '10px', color: 'var(--color-text-muted, #64748b)' }}>No browser lag</div>
                </div>

                <div style={{ textAlign: 'center', padding: '12px 8px', borderRadius: '10px', backgroundColor: 'var(--color-bg-secondary, #f8fafc)', border: '1px solid var(--color-border, #e2e8f0)' }}>
                  <HardDrive size={20} color="#10b981" style={{ margin: '0 auto 4px', display: 'block' }} />
                  <div style={{ fontSize: '11px', fontWeight: 700 }}>100% Offline</div>
                  <div style={{ fontSize: '10px', color: 'var(--color-text-muted, #64748b)' }}>Unlimited storage</div>
                </div>

                <div style={{ textAlign: 'center', padding: '12px 8px', borderRadius: '10px', backgroundColor: 'var(--color-bg-secondary, #f8fafc)', border: '1px solid var(--color-border, #e2e8f0)' }}>
                  <ShieldCheck size={20} color="#8b5cf6" style={{ margin: '0 auto 4px', display: 'block' }} />
                  <div style={{ fontSize: '11px', fontWeight: 700 }}>Cloud Auto-Sync</div>
                  <div style={{ fontSize: '10px', color: 'var(--color-text-muted, #64748b)' }}>Realtime to Firebase</div>
                </div>
              </div>

              {/* Install Trigger Button */}
              {canInstall ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleInstallClick}
                  style={{
                    width: '100%',
                    padding: '14px 20px',
                    fontSize: '15px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    borderRadius: '12px',
                    boxShadow: '0 4px 14px 0 rgba(14, 165, 233, 0.39)',
                  }}
                >
                  <Download size={18} />
                  Install LAMBA Desktop App
                </button>
              ) : isAppInstalled || installedSuccess ? (
                <div style={{
                  padding: '14px',
                  borderRadius: '12px',
                  backgroundColor: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  color: '#166534',
                  textAlign: 'center',
                  fontWeight: 600,
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}>
                  <Check size={18} />
                  LAMBA Panel is installed as a Desktop App!
                </div>
              ) : (
                <div style={{
                  padding: '16px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--color-bg-secondary, #f8fafc)',
                  border: '1px solid var(--color-border, #e2e8f0)',
                }}>
                  <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Download size={15} color="#0284c7" /> Easy 1-Click Desktop Setup:
                  </div>
                  <ol style={{ margin: 0, paddingLeft: '20px', fontSize: '12px', color: 'var(--color-text-muted, #64748b)', lineHeight: 1.6 }}>
                    <li>Look at the right side of your browser address bar for the <strong>Install App (⊕)</strong> icon.</li>
                    <li>Click <strong>Install</strong> to add LAMBA to your Applications / Dock / Taskbar.</li>
                    <li>Launch anytime directly from your desktop, even without Wi-Fi!</li>
                  </ol>
                </div>
              )}
            </div>
          ) : (
            <div>
              {/* Mobile Install Guide */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                marginBottom: '16px',
              }}>
                {/* iOS Safari Box */}
                <div style={{
                  padding: '14px 16px',
                  borderRadius: '12px',
                  border: '1px solid var(--color-border, #e2e8f0)',
                  backgroundColor: 'var(--color-bg-secondary, #f8fafc)',
                }}>
                  <div style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    🍏 iPhone / iPad (Safari)
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted, #64748b)', lineHeight: 1.6 }}>
                    1. Tap the <strong>Share</strong> button <Share size={13} style={{ display: 'inline', verticalAlign: 'middle' }} /> at the bottom of Safari.<br />
                    2. Scroll down and tap <strong>'Add to Home Screen'</strong> <PlusSquare size={13} style={{ display: 'inline', verticalAlign: 'middle' }} />.<br />
                    3. Tap <strong>'Add'</strong> in the top corner. Opens in full screen!
                  </div>
                </div>

                {/* Android Chrome Box */}
                <div style={{
                  padding: '14px 16px',
                  borderRadius: '12px',
                  border: '1px solid var(--color-border, #e2e8f0)',
                  backgroundColor: 'var(--color-bg-secondary, #f8fafc)',
                }}>
                  <div style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    🤖 Android (Chrome)
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted, #64748b)', lineHeight: 1.6 }}>
                    {canInstall ? (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={handleInstallClick}
                        style={{ marginTop: '4px', width: '100%', fontWeight: 700 }}
                      >
                        <Download size={14} /> Tap Here to Install App Now
                      </button>
                    ) : (
                      <>
                        1. Tap the <strong>three dots (⋮)</strong> in Chrome top-right.<br />
                        2. Tap <strong>'Install app'</strong> or <strong>'Add to Home screen'</strong>.<br />
                        3. Confirm install.
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Footer note */}
          <div style={{
            marginTop: '18px',
            paddingTop: '16px',
            borderTop: '1px solid var(--color-border, #e2e8f0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '11px',
            color: 'var(--color-text-muted, #64748b)',
          }}>
            <span>🔒 All offline orders & shops sync automatically when internet reconnects</span>
            <button
              type="button"
              className="btn btn-link btn-sm"
              onClick={onClose}
              style={{ fontSize: '12px', fontWeight: 600 }}
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
