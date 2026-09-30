// Select Company Page — Clean light theme matching panel design system
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ref, onValue, update } from 'firebase/database';
import { database } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { logout } from '../../services/authService';
import { Building2, Plus, ArrowRight, CheckCircle2, Users, LogOut, ShieldCheck, Search, Briefcase, XCircle, Clock } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';

export default function SelectCompanyPage() {
  const { userProfile, companyId, currentUser } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectingId, setSelectingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!userProfile?.uid) return;

    const compsRef = ref(database, 'companies');
    const unsub = onValue(compsRef, (snap) => {
      const userComps = [];
      if (snap.exists()) {
        snap.forEach((child) => {
          const companyData = child.val();
          const info = companyData ? companyData.info : null;
          const employees = companyData ? companyData.employees : null;

          // Check if user is owner OR listed in employees
          const isOwner = info && info.ownerUid === userProfile.uid;
          const isEmployee = employees && employees[userProfile.uid];

          if (isOwner || isEmployee) {
            const empCount = employees ? Object.keys(employees).length : 0;
            userComps.push({
              id: child.key,
              name: info?.name || 'Unnamed Company',
              joinCode: info?.joinCode || '',
              currency: info?.currency || 'Rs',
              owner: info?.owner || 'Admin',
              phone: info?.phone || '',
              isOwner: isOwner,
              employeeCount: empCount,
              status: info?.status || 'active',
              createdAt: info?.createdAt || Date.now(),
            });
          }
        });
      }

      setCompanies(userComps);
      setLoading(false);
    });

    return () => unsub();
  }, [userProfile?.uid]);

  const handleSelectCompany = async (targetCompanyId) => {
    setSelectingId(targetCompanyId);
    try {
      await update(ref(database, `users/${userProfile.uid}`), { companyId: targetCompanyId });
      sessionStorage.setItem('company_selected', 'true');
      toast.success('Switched to company workspace!');
      navigate('/dashboard');
    } catch (err) {
      console.error('Error selecting company:', err);
      toast.error('Failed to select company');
      setSelectingId(null);
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

  const filteredCompanies = companies.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.joinCode.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f8fafc',
      }}>
        <div className="loading-spinner lg" style={{ width: 44, height: 44, borderTopColor: '#2563eb' }} />
        <p style={{ marginTop: 16, color: '#64748b', fontSize: 14, fontWeight: 500 }}>
          Loading companies...
        </p>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f8fafc',
      color: '#0f172a',
      fontFamily: 'inherit',
    }}>
      {/* Header Bar */}
      <header className="select-company-header">
        <div className="select-company-brand">
          <div className="select-company-logo">
            <Building2 size={22} />
          </div>
          <div>
            <div className="select-company-title">BizManager</div>
            <div className="select-company-sub">Company Selector</div>
          </div>
        </div>

        <div className="select-company-user">
          <div className="select-company-user-info">
            <div className="select-company-user-name">{userProfile?.name || 'Admin'}</div>
            <div className="select-company-user-email">{currentUser?.email}</div>
          </div>
          <button
            onClick={handleLogout}
            className="select-company-logout-btn"
            title="Sign Out"
          >
            <LogOut size={16} /> <span className="logout-text">Logout</span>
          </button>
        </div>
      </header>

      {/* Main Content Container */}
      <main style={{ maxWidth: 1040, margin: '0 auto', padding: '40px 20px' }}>
        {/* Title Banner */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 16px',
            borderRadius: 20,
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            color: '#1d4ed8',
            fontSize: 13,
            fontWeight: 600,
            marginBottom: 14,
          }}>
            <Briefcase size={14} /> Select Workspace
          </div>
          <h1 style={{ fontSize: 30, fontWeight: 800, color: '#0f172a', margin: '0 0 10px 0' }}>
            Which company do you want to manage?
          </h1>
          <p style={{ fontSize: 15, color: '#64748b', margin: 0 }}>
            Select from your registered companies to enter its workspace dashboard.
          </p>
        </div>

        {/* Search Bar if > 3 companies */}
        {companies.length > 3 && (
          <div style={{ maxWidth: 440, margin: '0 auto 30px auto', position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Search companies by name or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px 10px 42px',
                borderRadius: 10,
                border: '1px solid #cbd5e1',
                fontSize: 14,
                outline: 'none',
                background: '#ffffff',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              }}
            />
          </div>
        )}

        {/* Grid of Companies */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))',
          gap: 24,
          marginBottom: 40,
        }}>
          {filteredCompanies.map((comp) => {
            const isActive = comp.id === companyId;
            const isProcessing = selectingId === comp.id;

            return (
              <div
                key={comp.id}
                style={{
                  background: '#ffffff',
                  border: isActive ? '2px solid #2563eb' : '1px solid #e2e8f0',
                  borderRadius: 16,
                  padding: 24,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: isActive 
                    ? '0 10px 25px -5px rgba(37, 99, 235, 0.15), 0 4px 6px -2px rgba(37, 99, 235, 0.05)'
                    : '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
                  transition: 'all 0.2s ease-in-out',
                  position: 'relative',
                }}
                onMouseOver={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.borderColor = '#93c5fd';
                    e.currentTarget.style.boxShadow = '0 12px 20px -5px rgba(0, 0, 0, 0.08)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }
                }}
                onMouseOut={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.borderColor = '#e2e8f0';
                    e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.05)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }
                }}
              >
                <div>
                  {/* Status / Active Badge */}
                  {comp.status === 'pending' ? (
                    <div style={{
                      position: 'absolute',
                      top: 18,
                      right: 18,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '4px 10px',
                      borderRadius: 20,
                      background: '#fef3c7',
                      border: '1px solid #fde68a',
                      color: '#d97706',
                      fontSize: 11,
                      fontWeight: 700,
                    }}>
                      <Clock size={13} /> Pending Verification
                    </div>
                  ) : (comp.status === 'closed' || comp.status === 'disabled') ? (
                    <div style={{
                      position: 'absolute',
                      top: 18,
                      right: 18,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '4px 10px',
                      borderRadius: 20,
                      background: '#fee2e2',
                      border: '1px solid #fca5a5',
                      color: '#dc2626',
                      fontSize: 11,
                      fontWeight: 700,
                    }}>
                      <XCircle size={13} /> Closed by System
                    </div>
                  ) : isActive ? (
                    <div style={{
                      position: 'absolute',
                      top: 18,
                      right: 18,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '4px 10px',
                      borderRadius: 20,
                      background: '#eff6ff',
                      border: '1px solid #bfdbfe',
                      color: '#2563eb',
                      fontSize: 11,
                      fontWeight: 700,
                    }}>
                      <CheckCircle2 size={13} /> Current
                    </div>
                  ) : null}

                  {/* Company Icon & Name */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
                    <div style={{
                      width: 50,
                      height: 50,
                      borderRadius: 12,
                      background: comp.isOwner ? '#eff6ff' : '#f0fdf4',
                      border: comp.isOwner ? '1px solid #bfdbfe' : '1px solid #bbf7d0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: comp.isOwner ? '#2563eb' : '#16a34a',
                    }}>
                      <Building2 size={26} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: '0 0 2px 0' }}>
                        {comp.name}
                      </h3>
                      <span style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: comp.isOwner ? '#2563eb' : '#16a34a',
                      }}>
                        {comp.isOwner ? 'Owner Account' : 'Employee Access'}
                      </span>
                    </div>
                  </div>

                  {/* Details Box */}
                  <div style={{
                    background: '#f8fafc',
                    borderRadius: 10,
                    padding: '12px 16px',
                    border: '1px solid #f1f5f9',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    fontSize: 13,
                    marginBottom: 20,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#64748b' }}>Admin Code:</span>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#1e293b', background: '#e2e8f0', padding: '2px 8px', borderRadius: 4 }}>
                        {comp.joinCode || 'N/A'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#64748b' }}>Staff Members:</span>
                      <span style={{ fontWeight: 600, color: '#334155', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Users size={14} color="#64748b" /> {comp.employeeCount} member(s)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Blue Button for Active Companies / Disabled or Pending Notice Box */}
                {comp.status === 'pending' ? (
                  <div style={{
                    width: '100%',
                    padding: '12px 18px',
                    borderRadius: 10,
                    background: '#fef3c7',
                    border: '1px solid #fde68a',
                    color: '#d97706',
                    fontSize: 13,
                    fontWeight: 700,
                    textAlign: 'center',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}>
                    <Clock size={16} /> Awaiting System Approval
                  </div>
                ) : (comp.status === 'closed' || comp.status === 'disabled') ? (
                  <div style={{
                    width: '100%',
                    padding: '12px 18px',
                    borderRadius: 10,
                    background: '#fee2e2',
                    border: '1px solid #fca5a5',
                    color: '#dc2626',
                    fontSize: 13,
                    fontWeight: 700,
                    textAlign: 'center',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}>
                    <XCircle size={16} /> Company Access Disabled
                  </div>
                ) : (
                  <button
                    disabled={isProcessing}
                    onClick={() => handleSelectCompany(comp.id)}
                    style={{
                      width: '100%',
                      padding: '12px 18px',
                      borderRadius: 10,
                      border: 'none',
                      background: isActive ? '#1d4ed8' : '#2563eb',
                      color: '#ffffff',
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
                      transition: 'all 0.2s',
                    }}
                    onMouseOver={(e) => {
                      if (!isProcessing) {
                        e.currentTarget.style.background = '#1d4ed8';
                        e.currentTarget.style.boxShadow = '0 6px 16px rgba(37, 99, 235, 0.35)';
                      }
                    }}
                    onMouseOut={(e) => {
                      if (!isProcessing) {
                        e.currentTarget.style.background = isActive ? '#1d4ed8' : '#2563eb';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(37, 99, 235, 0.25)';
                      }
                    }}
                  >
                    {isProcessing ? (
                      <span className="loading-spinner sm" style={{ width: 18, height: 18, borderTopColor: '#ffffff' }} />
                    ) : (
                      <>
                        {isActive ? 'Continue in Workspace' : 'Select & Move to Company'}
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                )}
              </div>
            );
          })}

          {/* Add New Company Card */}
          <div
            onClick={() => navigate('/setup')}
            style={{
              background: '#ffffff',
              border: '2px dashed #cbd5e1',
              borderRadius: 16,
              padding: 24,
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              minHeight: 220,
              transition: 'all 0.2s ease-in-out',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = '#2563eb';
              e.currentTarget.style.background = '#eff6ff';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = '#cbd5e1';
              e.currentTarget.style.background = '#ffffff';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: '#dbeafe',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#2563eb',
              marginBottom: 14,
            }}>
              <Plus size={26} />
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: '0 0 4px 0' }}>
              Add New Company
            </h3>
            <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
              Create another workspace for a different shop or business branch
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
