import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DollarSign, Download, Calendar } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { formatCurrency } from '../../utils/formatters';

export default function ProfitLossPage() {
  const { companyId, companyInfo } = useAuth();
  const navigate = useNavigate();
  const currency = companyInfo?.currency || 'Rs';

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Profit & Loss Statement</h1>
          <p className="text-muted text-sm">Financial performance overview</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-secondary">
            <Download size={14} /> Export PDF
          </button>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 800, margin: '0 auto' }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="card-title">Income Statement</span>
          <select className="form-select text-sm" style={{ width: 'auto' }}>
            <option>This Month</option>
            <option>Last Month</option>
            <option>This Year</option>
          </select>
        </div>
        
        <div className="card-body">
          {/* Revenue */}
          <div style={{ marginBottom: 'var(--space-6)' }}>
            <h3 style={{ color: 'var(--primary-600)', fontSize: 'var(--font-size-md)', marginBottom: 'var(--space-3)' }}>Revenue</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--gray-100)' }}>
              <span>Sales Revenue</span>
              <span className="font-medium">{formatCurrency(0, currency)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--gray-100)' }}>
              <span>Other Income</span>
              <span className="font-medium">{formatCurrency(0, currency)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-3) 0', fontWeight: 'bold' }}>
              <span>Total Revenue</span>
              <span style={{ fontSize: 'var(--font-size-lg)' }}>{formatCurrency(0, currency)}</span>
            </div>
          </div>

          {/* Cost of Goods Sold */}
          <div style={{ marginBottom: 'var(--space-6)' }}>
            <h3 style={{ color: 'var(--orange-600)', fontSize: 'var(--font-size-md)', marginBottom: 'var(--space-3)' }}>Cost of Goods Sold (COGS)</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--gray-100)' }}>
              <span>Product Costs (Purchases)</span>
              <span className="font-medium">{formatCurrency(0, currency)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-3) 0', fontWeight: 'bold' }}>
              <span>Total COGS</span>
              <span style={{ fontSize: 'var(--font-size-lg)' }}>{formatCurrency(0, currency)}</span>
            </div>
          </div>

          {/* Gross Profit */}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-4)', background: 'var(--gray-50)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-6)', fontWeight: 'bold' }}>
            <span>Gross Profit</span>
            <span style={{ fontSize: 'var(--font-size-lg)' }}>{formatCurrency(0, currency)}</span>
          </div>

          {/* Operating Expenses */}
          <div style={{ marginBottom: 'var(--space-6)' }}>
            <h3 style={{ color: 'var(--danger-600)', fontSize: 'var(--font-size-md)', marginBottom: 'var(--space-3)' }}>Operating Expenses</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--gray-100)' }}>
              <span>Rent & Utilities</span>
              <span className="font-medium">{formatCurrency(0, currency)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--gray-100)' }}>
              <span>Salaries</span>
              <span className="font-medium">{formatCurrency(0, currency)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--gray-100)' }}>
              <span>Marketing</span>
              <span className="font-medium">{formatCurrency(0, currency)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-3) 0', fontWeight: 'bold' }}>
              <span>Total Expenses</span>
              <span style={{ fontSize: 'var(--font-size-lg)' }}>{formatCurrency(0, currency)}</span>
            </div>
          </div>

          {/* Net Profit */}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-4)', background: 'var(--success-50)', color: 'var(--success-700)', borderRadius: 'var(--radius-md)', fontWeight: 'bold' }}>
            <span>Net Profit / (Loss)</span>
            <span style={{ fontSize: 'var(--font-size-xl)' }}>{formatCurrency(0, currency)}</span>
          </div>
          
        </div>
      </div>
    </div>
  );
}
