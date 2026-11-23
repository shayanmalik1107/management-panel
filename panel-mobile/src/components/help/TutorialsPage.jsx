import { BookOpen, PlayCircle, FileText } from 'lucide-react';

export default function TutorialsPage() {
  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Tutorials & Help</h1>
          <p className="text-muted text-sm">Learn how to use LAMBA effectively</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-6)' }}>
        
        <div className="card">
          <div className="card-header">
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <PlayCircle size={18} className="text-primary-600" /> Getting Started
            </span>
          </div>
          <div className="card-body">
            <p className="text-sm text-muted mb-4">Learn how to set up your company, invite employees, and customize your settings.</p>
            <button className="btn btn-secondary btn-block">Watch Video</button>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BookOpen size={18} className="text-primary-600" /> Inventory Management
            </span>
          </div>
          <div className="card-body">
            <p className="text-sm text-muted mb-4">Understand how stock moves automatically when you create orders or purchases.</p>
            <button className="btn btn-secondary btn-block">Read Guide</button>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={18} className="text-primary-600" /> Customer Balances
            </span>
          </div>
          <div className="card-body">
            <p className="text-sm text-muted mb-4">How to manage unpaid orders, credit limits, and receive payments.</p>
            <button className="btn btn-secondary btn-block">Read Guide</button>
          </div>
        </div>
        
      </div>
    </div>
  );
}
