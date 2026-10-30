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
                  <div style={{ fontSize: '11px', fontWeight: 700 }}>Instant Native Boot</div>
                  <div style={{ fontSize: '10px', color: 'var(--color-text-muted, #64748b)' }}>No Chrome browser lag</div>
                </div>

                <div style={{ textAlign: 'center', padding: '12px 8px', borderRadius: '10px', backgroundColor: 'var(--color-bg-secondary, #f8fafc)', border: '1px solid var(--color-border, #e2e8f0)' }}>
                  <HardDrive size={20} color="#10b981" style={{ margin: '0 auto 4px', display: 'block' }} />
                  <div style={{ fontSize: '11px', fontWeight: 700 }}>100% Offline</div>
                  <div style={{ fontSize: '10px', color: 'var(--color-text-muted, #64748b)' }}>Previous data loaded</div>
                </div>

                <div style={{ textAlign: 'center', padding: '12px 8px', borderRadius: '10px', backgroundColor: 'var(--color-bg-secondary, #f8fafc)', border: '1px solid var(--color-border, #e2e8f0)' }}>
                  <ShieldCheck size={20} color="#8b5cf6" style={{ margin: '0 auto 4px', display: 'block' }} />
                  <div style={{ fontSize: '11px', fontWeight: 700 }}>Cloud Auto-Sync</div>
                  <div style={{ fontSize: '10px', color: 'var(--color-text-muted, #64748b)' }}>Auto upload on reconnect</div>
                </div>
              </div>

              {/* Desktop Native Software Box */}
              <div style={{
                padding: '16px 18px',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                border: '1px solid var(--color-border, #cbd5e1)',
                marginBottom: '16px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 800, fontSize: '14px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Monitor size={17} color="#0284c7" /> Standalone Desktop Software (Mac / Win)
                  </span>
                  <span style={{ padding: '2px 8px', borderRadius: '6px', backgroundColor: '#e0f2fe', color: '#0369a1', fontSize: '11px', fontWeight: 700 }}>
                    Native Electron
                  </span>
                </div>
                <p style={{ margin: '0 0 10px', fontSize: '12px', color: '#475569', lineHeight: 1.5 }}>
                  A proper standalone desktop software without browser tabs, address bars, or extension icons. Opens instantly even without internet.
                </p>
                <div style={{
                  padding: '10px 14px',
                  backgroundColor: '#0f172a',
                  color: '#38bdf8',
                  borderRadius: '8px',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                  <span>npm run desktop</span>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>Launch Software</span>
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px' }}>
                  Standalone macOS App bundle located at: <code style={{ fontSize: '11px', color: '#0284c7' }}>dist-electron/mac/LAMBA Management Panel.app</code>
                </div>
              </div>

              {/* Install PWA as alternate */}
              {canInstall && (
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={handleInstallClick}
                  style={{
                    width: '100%',
                    padding: '10px 16px',
                    fontSize: '13px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    borderRadius: '10px',
                  }}
                >
                  <Download size={15} />
                  Add Quick Shortcut via Browser
                </button>
              )}
            </div>
          ) : (
            <div>
              {/* Feature Pill Row Mobile */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '10px',
                marginBottom: '16px',
              }}>
                <div style={{ textAlign: 'center', padding: '10px 6px', borderRadius: '10px', backgroundColor: 'var(--color-bg-secondary, #f8fafc)', border: '1px solid var(--color-border, #e2e8f0)' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#16a34a' }}>📦 APK Ready</div>
                  <div style={{ fontSize: '10px', color: 'var(--color-text-muted, #64748b)' }}>Real Android App</div>
                </div>
                <div style={{ textAlign: 'center', padding: '10px 6px', borderRadius: '10px', backgroundColor: 'var(--color-bg-secondary, #f8fafc)', border: '1px solid var(--color-border, #e2e8f0)' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#0284c7' }}>⚡ 100% Offline</div>
                  <div style={{ fontSize: '10px', color: 'var(--color-text-muted, #64748b)' }}>Data remains loaded</div>
                </div>
                <div style={{ textAlign: 'center', padding: '10px 6px', borderRadius: '10px', backgroundColor: 'var(--color-bg-secondary, #f8fafc)', border: '1px solid var(--color-border, #e2e8f0)' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#8b5cf6' }}>🔄 Auto-Sync</div>
                  <div style={{ fontSize: '10px', color: 'var(--color-text-muted, #64748b)' }}>Local until online</div>
                </div>
              </div>

              {/* Android APK Download Card */}
              <div style={{
                padding: '18px 20px',
                borderRadius: '16px',
                background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                border: '1.5px solid #86efac',
                marginBottom: '16px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ fontWeight: 800, fontSize: '15px', color: '#14532d', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    🤖 Android App (.APK Installer)
                  </div>
                  <span style={{ padding: '3px 8px', borderRadius: '6px', backgroundColor: '#15803d', color: '#ffffff', fontSize: '11px', fontWeight: 700 }}>
                    5.3 MB
                  </span>
                </div>
                <p style={{ margin: '0 0 14px', fontSize: '12px', color: '#166534', lineHeight: 1.5 }}>
                  Real standalone Android application. Opens without Chrome browser, logs in offline from saved session, loads previous records instantly, and auto-syncs orders to Firebase when internet returns.
                </p>

                <a
                  href="/downloads/lamba.apk"
                  download="lamba.apk"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    width: '100%',
                    padding: '13px 20px',
                    backgroundColor: '#16a34a',
                    color: '#ffffff',
                    fontWeight: 800,
                    fontSize: '14px',
                    borderRadius: '12px',
                    textDecoration: 'none',
                    boxShadow: '0 4px 14px 0 rgba(22, 163, 74, 0.35)',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <Download size={18} /> Download Android APK (lamba.apk)
                </a>

                <div style={{ marginTop: '12px', padding: '10px', backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: '8px', fontSize: '11px', color: '#15803d', lineHeight: 1.5 }}>
                  <strong>How to Install:</strong>
                  <ol style={{ margin: '4px 0 0', paddingLeft: '18px' }}>
                    <li>Click <strong>Download Android APK</strong> on your phone or computer.</li>
                    <li>Tap the downloaded <code>lamba.apk</code> and choose <strong>Install</strong> (Allow from this source if prompted).</li>
                    <li>Open <strong>LAMBA</strong> directly from your home screen!</li>
                  </ol>
                </div>
              </div>

              {/* iOS Safari Box */}
              <div style={{
                padding: '14px 16px',
                borderRadius: '12px',
                border: '1px solid var(--color-border, #e2e8f0)',
                backgroundColor: 'var(--color-bg-secondary, #f8fafc)',
              }}>
                <div style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  🍏 iPhone / iPad (Safari)
                </div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted, #64748b)', lineHeight: 1.6 }}>
                  1. Tap <strong>Share</strong> <Share size={13} style={{ display: 'inline', verticalAlign: 'middle' }} /> at the bottom of Safari.<br />
                  2. Select <strong>'Add to Home Screen'</strong> <PlusSquare size={13} style={{ display: 'inline', verticalAlign: 'middle' }} />.<br />
                  3. Tap <strong>'Add'</strong>. Opens in full screen native window!
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
