import React from 'react';
import { Wifi, WifiOff, RefreshCw, Database, CheckCircle2, AlertCircle, X, CloudOff, ArrowUpRight } from 'lucide-react';
import { useOffline } from '../../contexts/OfflineContext';
import { formatDate } from '../../utils/formatters';

export default function OfflineSyncStatus() {
  const {
    isOnline,
    isSyncing,
    pendingCount,
    pendingItems,
    lastSyncTime,
    syncNow,
    showSyncModal,
    setShowSyncModal,
  } = useOffline();

  return (
    <>
      {/* Navbar Status Pill */}
      <div 
        className={`sync-status-pill ${!isOnline ? 'offline' : pendingCount > 0 ? 'pending' : 'online'}`}
        onClick={() => setShowSyncModal(true)}
        title={!isOnline ? 'Working offline. Click to view pending sync.' : pendingCount > 0 ? `${pendingCount} items pending sync.` : 'Connected to cloud'}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 12px',
          borderRadius: '9999px',
          fontSize: '12px',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          userSelect: 'none',
          border: '1px solid transparent',
          background: !isOnline 
            ? 'rgba(239, 68, 68, 0.12)' 
            : pendingCount > 0 
              ? 'rgba(245, 158, 11, 0.12)' 
              : 'rgba(16, 185, 129, 0.1)',
          color: !isOnline 
            ? '#ef4444' 
            : pendingCount > 0 
              ? '#d97706' 
              : '#10b981',
          borderColor: !isOnline 
            ? 'rgba(239, 68, 68, 0.25)' 
            : pendingCount > 0 
              ? 'rgba(245, 158, 11, 0.25)' 
              : 'rgba(16, 185, 129, 0.2)',
        }}
      >
        {isSyncing ? (
          <>
            <RefreshCw size={13} className="spin-animation" />
            <span>Syncing ({pendingCount})...</span>
          </>
        ) : !isOnline ? (
          <>
            <WifiOff size={13} />
            <span>Offline {pendingCount > 0 ? `(${pendingCount})` : ''}</span>
          </>
        ) : pendingCount > 0 ? (
          <>
            <RefreshCw size={13} />
            <span>{pendingCount} Pending Sync</span>
          </>
        ) : (
          <>
            <span style={{ 
              width: '7px', 
              height: '7px', 
              borderRadius: '50%', 
              backgroundColor: '#10b981', 
              boxShadow: '0 0 8px rgba(16, 185, 129, 0.6)' 
            }} />
            <span>Online</span>
          </>
        )}
      </div>

      {/* Sync Details Modal */}
      {showSyncModal && (
        <div 
          className="modal-overlay" 
          onClick={() => setShowSyncModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.55)',
            backdropFilter: 'blur(4px)',
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
              borderRadius: '16px',
              maxWidth: '520px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
              overflow: 'hidden',
              border: '1px solid var(--color-border, #e2e8f0)',
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '18px 24px',
              borderBottom: '1px solid var(--color-border, #e2e8f0)',
              backgroundColor: 'var(--color-bg-secondary, #f8fafc)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  backgroundColor: !isOnline ? '#fee2e2' : '#e0f2fe',
                  color: !isOnline ? '#ef4444' : '#0284c7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {!isOnline ? <WifiOff size={18} /> : <Database size={18} />}
                </div>
                <div>
                  <h3 className="sync-center-title" style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                    Offline & Cloud Sync Center
                  </h3>
                  <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                    Unlimited local storage with real-time Firebase sync
                  </p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setShowSyncModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '6px',
                  color: 'var(--color-text-muted, #64748b)',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '20px 24px' }}>
              {/* Status Banner */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderRadius: '10px',
                marginBottom: '16px',
                backgroundColor: !isOnline ? '#fef2f2' : '#f0fdf4',
                border: `1px solid ${!isOnline ? '#fecaca' : '#bbf7d0'}`,
                color: !isOnline ? '#991b1b' : '#166534',
                fontSize: '13px',
                fontWeight: 500,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {!isOnline ? <WifiOff size={16} /> : <CheckCircle2 size={16} />}
                  <span>
                    {!isOnline 
                      ? 'You are currently offline. All orders, shops, and products are being stored locally.' 
                      : 'Connected to Internet. Real-time Firebase sync active.'}
                  </span>
                </div>
              </div>

              {/* Local Storage Info */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '12px',
                marginBottom: '20px',
              }}>
                <div style={{
                  padding: '12px 14px',
                  borderRadius: '10px',
                  border: '1px solid var(--color-border, #e2e8f0)',
                  backgroundColor: 'var(--color-bg-secondary, #f8fafc)',
                }}>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-muted, #64748b)', fontWeight: 600, textTransform: 'uppercase' }}>
                    Local Storage
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: 700, marginTop: '4px', color: '#10b981' }}>
                    Unlimited (Persistent)
                  </div>
                </div>

                <div style={{
                  padding: '12px 14px',
                  borderRadius: '10px',
                  border: '1px solid var(--color-border, #e2e8f0)',
                  backgroundColor: 'var(--color-bg-secondary, #f8fafc)',
                }}>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-muted, #64748b)', fontWeight: 600, textTransform: 'uppercase' }}>
                    Pending Sync Items
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: 700, marginTop: '4px', color: pendingCount > 0 ? '#d97706' : '#10b981' }}>
                    {pendingCount} {pendingCount === 1 ? 'record' : 'records'}
                  </div>
                </div>
              </div>

              {/* Pending Items List */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  marginBottom: '10px' 
                }}>
                  <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#0f172a' }}>
                    Outbox Queue ({pendingItems.length})
                  </h4>
                  {lastSyncTime && (
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted, #64748b)' }}>
                      Last sync: {new Date(lastSyncTime).toLocaleTimeString()}
                    </span>
                  )}
                </div>

                {pendingItems.length === 0 ? (
                  <div style={{
                    textAlign: 'center',
                    padding: '28px 16px',
                    borderRadius: '10px',
                    border: '1px dashed var(--color-border, #cbd5e1)',
                    color: 'var(--color-text-muted, #64748b)',
                    fontSize: '13px',
                  }}>
                    <CheckCircle2 size={28} color="#10b981" style={{ margin: '0 auto 8px', display: 'block' }} />
                    All records are synced with Firebase cloud!
                  </div>
                ) : (
                  <div style={{
                    maxHeight: '220px',
                    overflowY: 'auto',
                    border: '1px solid var(--color-border, #e2e8f0)',
                    borderRadius: '10px',
                    divideY: '1px solid var(--color-border, #e2e8f0)',
                  }}>
                    {pendingItems.map((item, idx) => (
                      <div 
                        key={item.id || idx}
                        style={{
                          padding: '10px 14px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          borderBottom: idx < pendingItems.length - 1 ? '1px solid var(--color-border, #f1f5f9)' : 'none',
                          fontSize: '13px',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600 }}>
                            {item.description || item.actionType.replace('_', ' ').toUpperCase()}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--color-text-muted, #64748b)', marginTop: '2px' }}>
                            Created by {item.userName || 'User'} • {formatDate(item.createdAt)}
                          </div>
                        </div>

                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 600,
                          backgroundColor: item.status === 'syncing' ? '#e0f2fe' : '#fef3c7',
                          color: item.status === 'syncing' ? '#0369a1' : '#b45309',
                        }}>
                          {item.status === 'syncing' ? 'Syncing...' : 'Pending'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Button */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={syncNow}
                  disabled={!isOnline || isSyncing || pendingCount === 0}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '10px 16px',
                    fontWeight: 600,
                  }}
                >
                  <RefreshCw size={16} className={isSyncing ? 'spin-animation' : ''} />
                  {isSyncing ? 'Syncing with Server...' : !isOnline ? 'Offline (Sync on Connect)' : pendingCount === 0 ? 'Everything Synced' : 'Sync Now to Firebase'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowSyncModal(false)}
                  style={{ padding: '10px 18px', fontWeight: 600 }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Animation Style */}
      <style>{`
        @keyframes spinSync {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin-animation {
          animation: spinSync 1s linear infinite;
        }
      `}</style>
    </>
  );
}
