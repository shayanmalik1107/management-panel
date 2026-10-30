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
                marginBottom: '16px',
              }}>
                <div style={{ textAlign: 'center', padding: '10px 8px', borderRadius: '10px', backgroundColor: 'var(--color-bg-secondary, #f8fafc)', border: '1px solid var(--color-border, #e2e8f0)' }}>
                  <Zap size={18} color="#0284c7" style={{ margin: '0 auto 4px', display: 'block' }} />
                  <div style={{ fontSize: '11px', fontWeight: 700 }}>Instant Native Boot</div>
                  <div style={{ fontSize: '10px', color: 'var(--color-text-muted, #64748b)' }}>No browser tabs</div>
                </div>

                <div style={{ textAlign: 'center', padding: '10px 8px', borderRadius: '10px', backgroundColor: 'var(--color-bg-secondary, #f8fafc)', border: '1px solid var(--color-border, #e2e8f0)' }}>
                  <HardDrive size={18} color="#10b981" style={{ margin: '0 auto 4px', display: 'block' }} />
                  <div style={{ fontSize: '11px', fontWeight: 700 }}>100% Offline</div>
                  <div style={{ fontSize: '10px', color: 'var(--color-text-muted, #64748b)' }}>Previous data loaded</div>
                </div>

                <div style={{ textAlign: 'center', padding: '10px 8px', borderRadius: '10px', backgroundColor: 'var(--color-bg-secondary, #f8fafc)', border: '1px solid var(--color-border, #e2e8f0)' }}>
                  <ShieldCheck size={18} color="#8b5cf6" style={{ margin: '0 auto 4px', display: 'block' }} />
                  <div style={{ fontSize: '11px', fontWeight: 700 }}>Cloud Auto-Sync</div>
                  <div style={{ fontSize: '10px', color: 'var(--color-text-muted, #64748b)' }}>Syncs when online</div>
                </div>
              </div>

              {/* Direct Desktop Software Download */}
              <div style={{
                padding: '16px 18px',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #f0fdf4 0%, #e0f2fe 100%)',
                border: '1.5px solid #38bdf8',
                marginBottom: '14px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ fontWeight: 800, fontSize: '15px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Monitor size={18} color="#0284c7" /> Standalone Mac App (.zip / .app)
                  </div>
                  <span style={{ padding: '2px 8px', borderRadius: '6px', backgroundColor: '#0284c7', color: '#ffffff', fontSize: '11px', fontWeight: 700 }}>
                    macOS Native
                  </span>
                </div>
                <p style={{ margin: '0 0 12px', fontSize: '12px', color: '#334155', lineHeight: 1.5 }}>
                  Real standalone macOS desktop software. Double-click to launch directly from your Applications folder. No Chrome tabs, no browser address bar, and opens instantly offline.
                </p>

                <a
                  href="https://github.com/shayanmalik1107/management-panel/releases/download/v1.0.0/LAMBA-Desktop-Mac.zip"
                  download="LAMBA-Desktop-Mac.zip"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    width: '100%',
                    padding: '12px 18px',
                    backgroundColor: '#0284c7',
                    color: '#ffffff',
                    fontWeight: 800,
                    fontSize: '14px',
                    borderRadius: '10px',
                    textDecoration: 'none',
                    boxShadow: '0 4px 12px 0 rgba(2, 132, 199, 0.35)',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <Download size={18} /> Download Mac Desktop App (LAMBA-Desktop-Mac.zip)
                </a>

                <div style={{ marginTop: '8px', fontSize: '11px', color: '#64748b' }}>
                  💡 <em>After downloading: Unzip and drag <strong>LAMBA Management Panel.app</strong> to your Applications folder or Dock.</em>
                </div>
              </div>

              {/* 1-Click Browser App Button */}
              <div style={{
                padding: '14px 16px',
                borderRadius: '12px',
                backgroundColor: 'var(--color-bg-secondary, #f8fafc)',
                border: '1px solid var(--color-border, #cbd5e1)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Zap size={15} color="#eab308" /> 1-Click Fast Install to Dock
                  </span>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>Browser Integration</span>
                </div>

                {canInstall ? (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={handleInstallClick}
                    style={{ width: '100%', padding: '10px', fontWeight: 700, fontSize: '13px', borderRadius: '8px' }}
                  >
                    <Download size={15} /> 1-Click Install to Applications Now
                  </button>
                ) : (
                  <div style={{ fontSize: '12px', color: '#475569', lineHeight: 1.5 }}>
                    👉 In your browser address bar (top right), click the purple <strong>'Open in app'</strong> or <strong>Install (⊕)</strong> button to add LAMBA directly to your Mac Dock with one click!
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div>
              {/* Feature Pill Row Mobile */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '8px',
                marginBottom: '14px',
              }}>
                <div style={{ textAlign: 'center', padding: '8px 4px', borderRadius: '8px', backgroundColor: 'var(--color-bg-secondary, #f8fafc)', border: '1px solid var(--color-border, #e2e8f0)' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#16a34a' }}>🤖 Android APK</div>
                  <div style={{ fontSize: '10px', color: 'var(--color-text-muted, #64748b)' }}>Direct Install</div>
                </div>
                <div style={{ textAlign: 'center', padding: '8px 4px', borderRadius: '8px', backgroundColor: 'var(--color-bg-secondary, #f8fafc)', border: '1px solid var(--color-border, #e2e8f0)' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#0284c7' }}>🍏 iPhone Native</div>
                  <div style={{ fontSize: '10px', color: 'var(--color-text-muted, #64748b)' }}>Full Screen</div>
                </div>
                <div style={{ textAlign: 'center', padding: '8px 4px', borderRadius: '8px', backgroundColor: 'var(--color-bg-secondary, #f8fafc)', border: '1px solid var(--color-border, #e2e8f0)' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#8b5cf6' }}>⚡ 100% Offline</div>
                  <div style={{ fontSize: '10px', color: 'var(--color-text-muted, #64748b)' }}>Preloads Data</div>
                </div>
              </div>

              {/* Android APK Download Card */}
              <div style={{
                padding: '14px 16px',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                border: '1.5px solid #86efac',
                marginBottom: '12px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <div style={{ fontWeight: 800, fontSize: '14px', color: '#14532d', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    🤖 Android Mobile App (.APK)
                  </div>
                  <span style={{ padding: '2px 6px', borderRadius: '6px', backgroundColor: '#15803d', color: '#ffffff', fontSize: '10px', fontWeight: 700 }}>
                    10 MB
                  </span>
                </div>
                <p style={{ margin: '0 0 10px', fontSize: '11.5px', color: '#166534', lineHeight: 1.4 }}>
                  Standalone Android application. Real home screen icon, keeps previous records loaded offline, and auto-syncs when internet reconnects.
                </p>

                <a
                  href="https://github.com/shayanmalik1107/management-panel/releases/download/v1.0.0/lamba.apk"
                  download="lamba.apk"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    width: '100%',
                    padding: '10px 16px',
                    backgroundColor: '#16a34a',
                    color: '#ffffff',
                    fontWeight: 800,
                    fontSize: '13px',
                    borderRadius: '10px',
                    textDecoration: 'none',
                    boxShadow: '0 4px 12px 0 rgba(22, 163, 74, 0.3)',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <Download size={16} /> Download Android APK (lamba.apk)
                </a>
              </div>

              {/* iOS iPhone / iPad Card */}
              <div style={{
                padding: '14px 16px',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                border: '1.5px solid #cbd5e1',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <div style={{ fontWeight: 800, fontSize: '14px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    🍏 iPhone & iPad (iOS Install)
                  </div>
                  <span style={{ padding: '2px 6px', borderRadius: '6px', backgroundColor: '#475569', color: '#ffffff', fontSize: '10px', fontWeight: 700 }}>
                    iOS System
                  </span>
                </div>
                
                <div style={{ fontSize: '11.5px', color: '#334155', lineHeight: 1.5, marginBottom: '8px' }}>
                  <strong>Why no .APK for iPhone?</strong> Apple strictly blocks .apk files (APK is Android only). Apple's official method to install apps outside the App Store is <strong>'Add to Home Screen'</strong>:
                </div>

                <div style={{
                  padding: '10px 12px',
                  backgroundColor: '#ffffff',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  fontSize: '11.5px',
                  color: '#1e293b',
                  lineHeight: 1.6,
                }}>
                  <div>1. Open this website in <strong>Safari</strong> on your iPhone.</div>
                  <div>2. Tap the <strong>Share</strong> button <Share size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> at the bottom.</div>
                  <div>3. Scroll down and tap <strong>'Add to Home Screen'</strong> <PlusSquare size={12} style={{ display: 'inline', verticalAlign: 'middle' }} />.</div>
                  <div>4. Tap <strong>'Add'</strong> in top right corner.</div>
                  <div style={{ marginTop: '4px', color: '#16a34a', fontWeight: 600 }}>
                    ✓ Installed as a real standalone app! Opens in full-screen with zero browser bars and works 100% offline.
                  </div>
                </div>

                <div style={{ marginTop: '10px' }}>
                  <a
                    href="https://github.com/shayanmalik1107/management-panel/releases/download/v1.0.0/LAMBA-iOS.ipa"
                    download="LAMBA-iOS.ipa"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      width: '100%',
                      padding: '8px 14px',
                      backgroundColor: '#334155',
                      color: '#ffffff',
                      fontWeight: 700,
                      fontSize: '12px',
                      borderRadius: '8px',
                      textDecoration: 'none',
                    }}
                  >
                    <Download size={14} /> Download iOS Native Package (.IPA)
                  </a>
                  <div style={{ marginTop: '4px', fontSize: '10.5px', color: '#64748b', textAlign: 'center' }}>
                    For Xcode / AltStore sideloading on Mac & iPhone
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
