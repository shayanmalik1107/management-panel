// Onboarding Checklist Component
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ref, get, update } from 'firebase/database';
import { database } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Check, X, Package, Store, Users, ShoppingCart, Receipt, Building2 } from 'lucide-react';

export default function OnboardingChecklist() {
  const { companyId, isAdmin, companyInfo } = useAuth();
  const navigate = useNavigate();
  const [onboarding, setOnboarding] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId || !isAdmin) { setLoading(false); return; }
    loadOnboarding();
  }, [companyId, isAdmin]);

  const loadOnboarding = async () => {
    try {
      const snap = await get(ref(database, `companies/${companyId}/onboarding`));
      if (snap.exists()) {
        setOnboarding(snap.val());
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  if (loading || !onboarding || onboarding.dismissed || !isAdmin) return null;

  const steps = [
    { key: 'companyProfile', label: 'Complete Company Profile', icon: Building2, path: '/settings' },
    { key: 'firstProduct', label: 'Add First Product', icon: Package, path: '/products/new' },
    { key: 'firstCustomer', label: 'Add First Customer', icon: Store, path: '/customers/new' },
    { key: 'inviteEmployee', label: 'Invite Employee', icon: Users, path: '/employees' },
    { key: 'firstOrder', label: 'Create First Order', icon: ShoppingCart, path: '/orders/new' },
    { key: 'firstExpense', label: 'Record First Expense', icon: Receipt, path: '/expenses/new' },
  ];

  const completedCount = steps.filter(s => onboarding[s.key]).length;
  const progress = Math.round((completedCount / steps.length) * 100);

  if (completedCount === steps.length) return null;

  const dismiss = async () => {
    await update(ref(database, `companies/${companyId}/onboarding`), { dismissed: true });
    setOnboarding({ ...onboarding, dismissed: true });
  };

  return (
    <div className="onboarding-card">
      <div className="onboarding-header">
        <h3>Welcome to {companyInfo?.name || 'LAMBA'}! Let's set up your business.</h3>
        <button className="btn btn-ghost btn-sm" onClick={dismiss}>
          <X size={16} /> Hide
        </button>
      </div>

      <div className="onboarding-progress">
        <div className="onboarding-progress-bar">
          <div className="onboarding-progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <span className="onboarding-progress-text">{progress}% Complete</span>
      </div>

      <div className="onboarding-items">
        {steps.map((step) => (
          <div
            key={step.key}
            className={`onboarding-item ${onboarding[step.key] ? 'completed' : ''}`}
            onClick={() => !onboarding[step.key] && navigate(step.path)}
          >
            <div className="onboarding-check">
              {onboarding[step.key] && <Check size={12} />}
            </div>
            <span className="onboarding-item-text">{step.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
