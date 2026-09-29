import { useState, useEffect } from 'react';
import { Users, Plus, RefreshCw, X, Copy, Mail, Shield, UserX, CheckCircle, Trash2, Loader2, Calendar } from 'lucide-react';
import { ref, onValue, update } from 'firebase/database';
import { database } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { regenerateJoinCode } from '../../services/authService';
import { useToast } from '../../contexts/ToastContext';
import { formatDate } from '../../utils/formatters';

export default function EmployeesList() {
  const { companyId, companyInfo, isAdmin, currentUser } = useAuth();
  const toast = useToast();
  
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [loadingCode, setLoadingCode] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) return;

    setLoading(true);
    const empRef = ref(database, `companies/${companyId}/employees`);

    const unsubscribe = onValue(empRef, (snapshot) => {
      const list = [];
      if (snapshot.exists()) {
        snapshot.forEach((child) => {
          list.push({ uid: child.key, ...child.val() });
        });
      }
      // Sort by joinedAt timestamp
      list.sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));
      setEmployees(list);
      setLoading(false);
    }, (err) => {
      console.error('Employees listener error:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [companyId]);

  const handleRegenerateCode = async () => {
    if (!window.confirm('Are you sure? The old code will stop working.')) return;
    setLoadingCode(true);
    try {
      await regenerateJoinCode(companyId, companyInfo?.joinCode);
      toast.success('New invite code generated');
    } catch (err) {
      toast.error('Failed to regenerate code');
    }
    setLoadingCode(false);
  };

  const handleCopyCode = () => {
    if (companyInfo?.joinCode) {
      navigator.clipboard.writeText(companyInfo.joinCode);
      toast.success('Code copied to clipboard');
    }
  };

  const handleToggleStatus = async (emp) => {
    if (emp.uid === currentUser?.uid) {
      toast.error('You cannot disable your own admin account');
      return;
    }
    const newStatus = emp.status === 'active' ? 'disabled' : 'active';
    try {
      const updates = {};
      updates[`companies/${companyId}/employees/${emp.uid}/status`] = newStatus;
      updates[`users/${emp.uid}/status`] = newStatus;
      await update(ref(database), updates);
      toast.success(`Employee ${emp.name || emp.email} set to ${newStatus}`);
    } catch (err) {
      console.error('Toggle status error:', err);
      toast.error('Failed to update employee status');
    }
  };

  const handleRemoveEmployee = async (emp) => {
    if (emp.uid === currentUser?.uid) {
      toast.error('You cannot remove yourself');
      return;
    }
    if (!window.confirm(`Are you sure you want to remove ${emp.name || emp.email} from your company?`)) return;

    try {
      const updates = {};
      updates[`companies/${companyId}/employees/${emp.uid}`] = null;
      updates[`users/${emp.uid}/companyId`] = null;
      await update(ref(database), updates);
      toast.success(`Employee ${emp.name || emp.email} removed from workspace`);
    } catch (err) {
      console.error('Remove employee error:', err);
      toast.error('Failed to remove employee');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Team / Employees</h1>
          <p className="text-muted text-sm">Manage staff access, roles, and permissions</p>
        </div>
        <div className="page-header-actions">
          {isAdmin && (
            <button className="btn btn-primary" onClick={() => setShowInviteModal(true)}>
              <Plus size={16} /> Invite Employee
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <div className="table-container">
          {loading ? (
            <div className="loading-page" style={{ minHeight: '200px' }}>
              <Loader2 size={24} className="animate-spin text-muted" />
            </div>
          ) : employees.length > 0 ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Staff Member</th>
                  <th>Role</th>
                  <th>Joined Date</th>
                  <th>Status</th>
                  {isAdmin && <th style={{ textAlign: 'right' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => {
                  const isEmpAdmin = emp.role === 'admin';
                  const isSelf = emp.uid === currentUser?.uid;

                  return (
                    <tr key={emp.uid}>
                      <td>
                        <div className="font-medium" style={{ color: 'var(--gray-900)' }}>
                          {emp.name || 'Unnamed Staff'} {isSelf && <span className="text-xs text-muted">(You)</span>}
                        </div>
                        {emp.email && (
                          <div className="text-xs text-muted" style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                            <Mail size={12} /> {emp.email}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${isEmpAdmin ? 'badge-blue' : 'badge-green'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', textTransform: 'capitalize' }}>
                          <Shield size={12} /> {emp.role || 'employee'}
                        </span>
                      </td>
                      <td className="text-sm text-muted">
                        {emp.joinedAt ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <Calendar size={13} /> {formatDate(emp.joinedAt)}
                          </span>
                        ) : '—'}
                      </td>
                      <td>
                        {emp.status === 'disabled' ? (
                          <span className="badge badge-red"><span className="badge-dot" />Disabled</span>
                        ) : (
                          <span className="badge badge-green"><span className="badge-dot" />Active</span>
                        )}
                      </td>
                      {isAdmin && (
                        <td style={{ textAlign: 'right' }}>
                          {!isSelf && (
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-1)' }}>
                              <button
                                className={`btn btn-ghost btn-sm ${emp.status === 'disabled' ? 'text-success' : 'text-warning'}`}
                                onClick={() => handleToggleStatus(emp)}
                                title={emp.status === 'disabled' ? 'Enable Employee' : 'Disable Employee'}
                              >
                                {emp.status === 'disabled' ? <CheckCircle size={14} /> : <UserX size={14} />}
                              </button>
                              <button
                                className="btn btn-ghost btn-sm text-danger"
                                onClick={() => handleRemoveEmployee(emp)}
                                title="Remove from Company"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
              <Users size={32} style={{ color: 'var(--gray-400)', marginBottom: 'var(--space-2)' }} />
              <h3>Team Management</h3>
              <p className="text-muted">Share your Admin Join Code with staff so they can create an account and join your workspace.</p>
              {isAdmin && (
                <button className="btn btn-primary mt-4" onClick={() => setShowInviteModal(true)}>
                  <Plus size={16} /> Invite Employee
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="modal-overlay" onClick={() => setShowInviteModal(false)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Invite Employee</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowInviteModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body text-center" style={{ padding: 'var(--space-6)' }}>
              <p className="text-muted mb-4">Share this secure code with your staff. They will enter it during registration to join your workspace.</p>
              
              <div style={{ background: 'var(--gray-50)', border: '1px dashed var(--gray-300)', padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-4)' }}>
                <span style={{ fontSize: '24px', fontWeight: 'bold', letterSpacing: '4px', color: 'var(--primary-600)' }}>
                  {companyInfo?.joinCode || '------'}
                </span>
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center' }}>
                <button className="btn btn-primary" onClick={handleCopyCode}>
                  <Copy size={16} /> Copy Code
                </button>
                <button className="btn btn-ghost" onClick={handleRegenerateCode} disabled={loadingCode}>
                  {loadingCode ? <span className="loading-spinner" /> : <RefreshCw size={16} />}
                  Generate New Code
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
