import { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { database } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { approveUserAccount, rejectUserAccount, updateUserCompanyLimit, logout } from '../../services/authService';
import { useToast } from '../../contexts/ToastContext';
import {
  ShieldCheck, CheckCircle2, XCircle, Edit2, Search,
  LogOut, Package, Sparkles
} from 'lucide-react';

export default function ControlPanelPage() {
  const { currentUser } = useAuth();
  const toast = useToast();

  const [users, setUsers] = useState([]);
  const [companies, setCompanies] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'active' | 'upgrades'
  const [searchQuery, setSearchQuery] = useState('');

  // Editing state for company limit modal
  const [editingUser, setEditingUser] = useState(null);
  const [customLimit, setCustomLimit] = useState(1);
  const [customPlan, setCustomPlan] = useState('basic');
  const [processingUid, setProcessingUid] = useState(null);

  useEffect(() => {
    // Real-time listener on all users
    const usersRef = ref(database, 'users');
    const unsubUsers = onValue(usersRef, (snap) => {
      const usersList = [];
      if (snap.exists()) {
        snap.forEach((child) => {
          usersList.push({
            uid: child.key,
            ...child.val(),
          });
        });
      }
      setUsers(usersList);
      setLoading(false);
    });

    // Real-time listener on all companies to count created companies per admin
    const compsRef = ref(database, 'companies');
    const unsubComps = onValue(compsRef, (snap) => {
      const compCounts = {};
      if (snap.exists()) {
        snap.forEach((child) => {
          const compInfo = child.val()?.info;
          if (compInfo && compInfo.ownerUid) {
            const owner = compInfo.ownerUid;
            compCounts[owner] = (compCounts[owner] || 0) + 1;
          }
        });
      }
      setCompanies(compCounts);
    });

    return () => {
      unsubUsers();
      unsubComps();
    };
  }, []);

  const handleApprove = async (uid, maxComp, planId) => {
    setProcessingUid(uid);
    try {
      await approveUserAccount(uid, maxComp, planId);
      toast.success('Account approved and activated in real-time!');
      setEditingUser(null);
    } catch (err) {
      console.error('Approval failed:', err);
      toast.error(err.message || 'Failed to approve account');
    } finally {
      setProcessingUid(null);
    }
  };

  const handleReject = async (uid) => {
    if (!window.confirm('Are you sure you want to reject/disable this account?')) return;
    setProcessingUid(uid);
    try {
      await rejectUserAccount(uid, 'Payment not verified');
      toast.success('Account rejected/disabled.');
    } catch (err) {
      toast.error('Failed to reject account');
    } finally {
      setProcessingUid(null);
    }
  };

  // Filter users by active tab & search
  const adminUsers = users.filter(u => u.role === 'admin' || !u.role);
  
  const pendingUsers = adminUsers.filter(u => 
    u.accountStatus === 'pending_approval' || 
    (u.package && u.package.status === 'pending_payment')
  );

  const activeUsers = adminUsers.filter(u => 
    u.accountStatus === 'active' || 
    u.approvalStatus === 'approved' || 
    (!u.accountStatus && u.companyId)
  );

  const upgradeUsers = adminUsers.filter(u => 
    u.upgradeRequest && u.upgradeRequest.status === 'pending'
  );

  let currentList = activeTab === 'pending' ? pendingUsers : activeTab === 'upgrades' ? upgradeUsers : activeUsers;

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    currentList = currentList.filter(u => 
      u.name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.phone?.includes(q)
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0f172a',
      color: '#f8fafc',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      {/* Header Bar */}
      <header style={{
        background: '#1e293b',
        borderBottom: '1px solid #334155',
        padding: '16px 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.4)',
          }}>
            <ShieldCheck size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: '#ffffff' }}>System Control Panel</h1>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>Super Admin Account & Subscription Management</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 13, color: '#cbd5e1' }}>
            Super Admin: <strong>{currentUser?.email}</strong>
          </div>
          <button
            onClick={() => logout().then(() => window.location.href = '/login')}
            style={{
              background: '#334155',
              border: '1px solid #475569',
              color: '#f8fafc',
              padding: '8px 14px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <LogOut size={15} /> Exit Panel
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '36px 24px' }}>
        {/* Top Stats Overview */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 20,
          marginBottom: 32,
        }}>
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 16, padding: 20 }}>
            <div style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600, marginBottom: 6 }}>Pending Verification</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: '#fbbf24' }}>{pendingUsers.length} Users</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Awaiting payment receipt review</div>
          </div>

          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 16, padding: 20 }}>
            <div style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600, marginBottom: 6 }}>Active Admin Subscriptions</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: '#4ade80' }}>{activeUsers.length} Active</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Approved business accounts</div>
          </div>

          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 16, padding: 20 }}>
            <div style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600, marginBottom: 6 }}>Pending Upgrade Requests</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: '#60a5fa' }}>{upgradeUsers.length} Requests</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Basic to Pro plan upgrade requests</div>
          </div>
        </div>

        {/* Filter Tabs & Search */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          marginBottom: 24,
        }}>
          <div style={{ display: 'flex', background: '#1e293b', padding: 4, borderRadius: 12, border: '1px solid #334155' }}>
            <button
              onClick={() => setActiveTab('pending')}
              style={{
                background: activeTab === 'pending' ? '#2563eb' : 'transparent',
                color: activeTab === 'pending' ? '#ffffff' : '#94a3b8',
                border: 'none',
                padding: '10px 20px',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              🟡 Pending Approvals ({pendingUsers.length})
            </button>

            <button
              onClick={() => setActiveTab('active')}
              style={{
                background: activeTab === 'active' ? '#2563eb' : 'transparent',
                color: activeTab === 'active' ? '#ffffff' : '#94a3b8',
                border: 'none',
                padding: '10px 20px',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              🟢 Active Accounts ({activeUsers.length})
            </button>

            <button
              onClick={() => setActiveTab('upgrades')}
              style={{
                background: activeTab === 'upgrades' ? '#2563eb' : 'transparent',
                color: activeTab === 'upgrades' ? '#ffffff' : '#94a3b8',
                border: 'none',
                padding: '10px 20px',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              🚀 Upgrade Requests ({upgradeUsers.length})
            </button>
          </div>

          {/* Search Box */}
          <div style={{ position: 'relative', minWidth: 280 }}>
            <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input
              type="text"
              placeholder="Search by name, email or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: 10,
                padding: '10px 14px 10px 38px',
                color: '#ffffff',
                fontSize: 14,
                outline: 'none',
              }}
            />
          </div>
        </div>

        {/* Data Table */}
        <div style={{
          background: '#1e293b',
          border: '1px solid #334155',
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
        }}>
          {loading ? (
            <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>
              <div className="loading-spinner lg" style={{ margin: '0 auto 16px auto', borderTopColor: '#60a5fa' }} />
              Loading admin accounts...
            </div>
          ) : currentList.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>
              <Package size={40} style={{ margin: '0 auto 12px auto', opacity: 0.5 }} />
              <div style={{ fontSize: 16, fontWeight: 700 }}>No accounts found in this view</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Try switching tabs or adjusting search term.</div>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#0f172a', borderBottom: '1px solid #334155', color: '#94a3b8', fontSize: 12, textTransform: 'uppercase' }}>
                  <th style={{ padding: '16px 20px' }}>Admin User</th>
                  <th style={{ padding: '16px 20px' }}>Contact</th>
                  <th style={{ padding: '16px 20px' }}>Selected Plan</th>
                  <th style={{ padding: '16px 20px' }}>Company Limit</th>
                  <th style={{ padding: '16px 20px' }}>Companies Created</th>
                  <th style={{ padding: '16px 20px' }}>Registered On</th>
                  <th style={{ padding: '16px 20px', textAlign: 'right' }}>Control Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentList.map((user) => {
                  const pkg = user.package || {};
                  const planName = pkg.name || (pkg.planId === 'pro' ? 'Pro Package' : 'Basic Package');
                  const price = pkg.price || (pkg.planId === 'pro' ? 10000 : 5000);
                  const maxComp = user.maxCompanies || pkg.maxCompanies || (pkg.planId === 'pro' ? 3 : 1);
                  const createdCount = companies[user.uid] || 0;
                  const isProcessing = processingUid === user.uid;

                  return (
                    <tr key={user.uid} style={{ borderBottom: '1px solid #334155' }}>
                      {/* Name */}
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ fontWeight: 700, color: '#ffffff' }}>{user.name || 'Unnamed Admin'}</div>
                        <div style={{ fontSize: 12, color: '#64748b', fontFamily: 'monospace' }}>UID: {user.uid.slice(0, 8)}...</div>
                      </td>

                      {/* Contact */}
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ color: '#cbd5e1' }}>{user.email}</div>
                        <div style={{ fontSize: 12, color: '#94a3b8' }}>{user.phone || 'No Phone'}</div>
                      </td>

                      {/* Plan */}
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          background: pkg.planId === 'pro' ? '#1e3a8a' : '#1e293b',
                          border: pkg.planId === 'pro' ? '1px solid #3b82f6' : '1px solid #475569',
                          color: pkg.planId === 'pro' ? '#93c5fd' : '#cbd5e1',
                          padding: '4px 12px',
                          borderRadius: 20,
                          fontSize: 12,
                          fontWeight: 700,
                        }}>
                          {planName} (Rs. {price.toLocaleString()})
                        </div>
                      </td>

                      {/* Limit */}
                      <td style={{ padding: '16px 20px' }}>
                        <span style={{ fontSize: 16, fontWeight: 800, color: '#60a5fa' }}>
                          {maxComp} Company Slot{maxComp > 1 ? 's' : ''}
                        </span>
                      </td>

                      {/* Created Count */}
                      <td style={{ padding: '16px 20px' }}>
                        <span style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: createdCount >= maxComp ? '#f87171' : '#4ade80',
                          background: '#0f172a',
                          padding: '4px 10px',
                          borderRadius: 6,
                          border: '1px solid #334155',
                        }}>
                          {createdCount} / {maxComp}
                        </span>
                      </td>

                      {/* Registered Date */}
                      <td style={{ padding: '16px 20px', color: '#94a3b8', fontSize: 13 }}>
                        {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                          {activeTab === 'pending' && (
                            <>
                              <button
                                disabled={isProcessing}
                                onClick={() => {
                                  setEditingUser(user);
                                  setCustomLimit(maxComp);
                                  setCustomPlan(pkg.planId || 'basic');
                                }}
                                style={{
                                  background: '#2563eb',
                                  border: 'none',
                                  color: '#ffffff',
                                  padding: '8px 14px',
                                  borderRadius: 8,
                                  fontSize: 13,
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 6,
                                }}
                              >
                                <CheckCircle2 size={15} /> Review & Approve
                              </button>
                              <button
                                disabled={isProcessing}
                                onClick={() => handleReject(user.uid)}
                                style={{
                                  background: '#ef4444',
                                  border: 'none',
                                  color: '#ffffff',
                                  padding: '8px 12px',
                                  borderRadius: 8,
                                  fontSize: 13,
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                              >
                                <XCircle size={15} />
                              </button>
                            </>
                          )}

                          {activeTab === 'upgrades' && (
                            <button
                              disabled={isProcessing}
                              onClick={() => handleApprove(user.uid, 3, 'pro')}
                              style={{
                                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                                border: 'none',
                                color: '#ffffff',
                                padding: '8px 14px',
                                borderRadius: 8,
                                fontSize: 13,
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                              }}
                            >
                              <Sparkles size={15} /> Approve Upgrade to Pro (3 Companies)
                            </button>
                          )}

                          {activeTab === 'active' && (
                            <button
                              disabled={isProcessing}
                              onClick={() => {
                                setEditingUser(user);
                                setCustomLimit(maxComp);
                                setCustomPlan(pkg.planId || 'basic');
                              }}
                              style={{
                                background: '#334155',
                                border: '1px solid #475569',
                                color: '#ffffff',
                                padding: '8px 14px',
                                borderRadius: 8,
                                fontSize: 13,
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                              }}
                            >
                              <Edit2 size={14} /> Edit Limit / Plan
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {/* Approval & Limit Modal */}
      {editingUser && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: 20,
        }}>
          <div style={{
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: 20,
            padding: 32,
            maxWidth: 480,
            width: '100%',
            color: '#ffffff',
          }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>
              {editingUser.accountStatus === 'pending_approval' ? 'Approve Account & Set Limits' : 'Modify Account Plan & Limits'}
            </h2>
            <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 24 }}>
              Configuring access for <strong>{editingUser.name}</strong> ({editingUser.email})
            </p>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#cbd5e1', marginBottom: 8 }}>
                Subscription Plan:
              </label>
              <select
                value={customPlan}
                onChange={(e) => {
                  const p = e.target.value;
                  setCustomPlan(p);
                  setCustomLimit(p === 'basic' ? 1 : 3);
                }}
                style={{
                  width: '100%',
                  background: '#0f172a',
                  border: '1px solid #475569',
                  borderRadius: 10,
                  padding: '12px 14px',
                  color: '#ffffff',
                  fontSize: 14,
                }}
              >
                <option value="basic">Basic Plan (Rs. 5,000 / mo) — 1 Company Standard</option>
                <option value="pro">Pro Plan (Rs. 10,000 / mo) — 3 Companies Standard</option>
              </select>
            </div>

            <div style={{ marginBottom: 28 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#cbd5e1', marginBottom: 8 }}>
                Allowed Companies Count (Max Limit):
              </label>
              <input
                type="number"
                min="1"
                max="50"
                value={customLimit}
                onChange={(e) => setCustomLimit(parseInt(e.target.value, 10) || 1)}
                style={{
                  width: '100%',
                  background: '#0f172a',
                  border: '1px solid #475569',
                  borderRadius: 10,
                  padding: '12px 14px',
                  color: '#ffffff',
                  fontSize: 16,
                  fontWeight: 700,
                }}
              />
              <span style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginTop: 6 }}>
                Super Admin can set any custom company limit (e.g. 1, 2, 3, 5, etc.)
              </span>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                disabled={processingUid !== null}
                onClick={() => handleApprove(editingUser.uid, customLimit, customPlan)}
                style={{
                  flex: 1,
                  background: '#2563eb',
                  border: 'none',
                  color: '#ffffff',
                  padding: '12px 18px',
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {editingUser.accountStatus === 'pending_approval' ? 'Approve & Activate' : 'Save Changes'}
              </button>
              <button
                onClick={() => setEditingUser(null)}
                style={{
                  background: '#334155',
                  border: 'none',
                  color: '#cbd5e1',
                  padding: '12px 18px',
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
