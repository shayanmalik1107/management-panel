import { useState } from 'react';
import { Filter, Calendar, Minus, Plus, RefreshCw, ChevronDown } from 'lucide-react';

export default function FilterPanel({
  title = 'Order Filters',
  subtitle = 'Filter and analyze records by date range',
  icon: IconComponent = Filter,
  
  // Period filter (Daily, Weekly, Monthly)
  period = '',
  setPeriod = () => {},
  
  // Date Range Pickers
  startDate = '',
  setStartDate = () => {},
  endDate = '',
  setEndDate = () => {},
  
  // Quick Filters (Today, This Week, This Month)
  quickFilter = '',
  setQuickFilter = () => {},
  
  // Dropdown 1 (e.g. Shop / Supplier / Customer)
  dropdown1Label = 'Shop',
  dropdown1Value = '',
  setDropdown1Value = () => {},
  dropdown1Options = [], // array of { value, label } or strings
  dropdown1Icon: Dropdown1Icon = ChevronDown,
  
  // Dropdown 2 (e.g. Created By / Payment Mode / Status)
  dropdown2Label = 'Created By',
  dropdown2Value = '',
  setDropdown2Value = () => {},
  dropdown2Options = [], // array of { value, label } or strings
  dropdown2Icon: Dropdown2Icon = ChevronDown,

  // Additional custom fields or search if needed
  extraFields = null,
  
  // Reset Callback
  onReset = null
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  const handlePeriodClick = (pVal) => {
    if (period === pVal) {
      setPeriod('');
      return;
    }
    setPeriod(pVal);
    
    // Set appropriate start/end date range for period
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    
    if (pVal === 'daily') {
      setStartDate(todayStr);
      setEndDate(todayStr);
      setQuickFilter('today');
    } else if (pVal === 'weekly') {
      const firstDay = new Date(now);
      const day = now.getDay() || 7;
      if (day !== 1) firstDay.setDate(now.getDate() - (day - 1));
      setStartDate(firstDay.toISOString().split('T')[0]);
      setEndDate(todayStr);
      setQuickFilter('this_week');
    } else if (pVal === 'monthly') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(firstDay.toISOString().split('T')[0]);
      setEndDate(todayStr);
      setQuickFilter('this_month');
    }
  };

  const handleQuickFilterClick = (qVal) => {
    if (quickFilter === qVal) {
      setQuickFilter('');
      return;
    }
    setQuickFilter(qVal);
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (qVal === 'today') {
      setStartDate(todayStr);
      setEndDate(todayStr);
      setPeriod('daily');
    } else if (qVal === 'this_week') {
      const firstDay = new Date(now);
      const day = now.getDay() || 7;
      if (day !== 1) firstDay.setDate(now.getDate() - (day - 1));
      setStartDate(firstDay.toISOString().split('T')[0]);
      setEndDate(todayStr);
      setPeriod('weekly');
    } else if (qVal === 'this_month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(firstDay.toISOString().split('T')[0]);
      setEndDate(todayStr);
      setPeriod('monthly');
    }
  };

  const isFilterActive = startDate || endDate || period || quickFilter || dropdown1Value || dropdown2Value;

  return (
    <div className="filter-panel-card">
      {/* Header */}
      <div className="filter-panel-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="filter-panel-title-group">
          <div className="filter-panel-icon">
            <IconComponent size={18} />
          </div>
          <div>
            <h3 className="filter-panel-title">
              {title}
              {isFilterActive && (
                <span className="badge badge-purple" style={{ fontSize: 10, padding: '1px 6px' }}>
                  Active
                </span>
              )}
            </h3>
            <p className="filter-panel-subtitle">{subtitle}</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          {isFilterActive && onReset && (
            <button
              type="button"
              className="btn btn-ghost btn-xs text-muted"
              onClick={(e) => {
                e.stopPropagation();
                onReset();
              }}
              style={{ color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}
              title="Reset Filters"
            >
              <RefreshCw size={12} /> Reset
            </button>
          )}

          <button
            type="button"
            className="filter-panel-toggle-btn"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            aria-label="Toggle Filter Panel"
          >
            {isExpanded ? <Minus size={16} /> : <Plus size={16} />}
          </button>
        </div>
      </div>

      {/* Collapsible Body */}
      {isExpanded && (
        <div className="filter-panel-body">
          {/* Column 1: Period & Quick Filters */}
          <div className="filter-panel-col">
            <div>
              <div className="filter-section-label">Period</div>
              <div className="filter-btn-group-row">
                <button
                  type="button"
                  className={`filter-btn-pill ${period === 'daily' ? 'active' : ''}`}
                  onClick={() => handlePeriodClick('daily')}
                >
                  Daily
                </button>
                <button
                  type="button"
                  className={`filter-btn-pill ${period === 'weekly' ? 'active' : ''}`}
                  onClick={() => handlePeriodClick('weekly')}
                >
                  Weekly
                </button>
                <button
                  type="button"
                  className={`filter-btn-pill ${period === 'monthly' ? 'active' : ''}`}
                  onClick={() => handlePeriodClick('monthly')}
                >
                  Monthly
                </button>
              </div>
            </div>

            <div>
              <div className="filter-section-label">Quick Filters</div>
              <div className="filter-btn-group-vertical">
                <button
                  type="button"
                  className={`filter-btn-pill-v ${quickFilter === 'today' ? 'active' : ''}`}
                  onClick={() => handleQuickFilterClick('today')}
                >
                  Today
                </button>
                <button
                  type="button"
                  className={`filter-btn-pill-v ${quickFilter === 'this_week' ? 'active' : ''}`}
                  onClick={() => handleQuickFilterClick('this_week')}
                >
                  This Week
                </button>
                <button
                  type="button"
                  className={`filter-btn-pill-v ${quickFilter === 'this_month' ? 'active' : ''}`}
                  onClick={() => handleQuickFilterClick('this_month')}
                >
                  This Month
                </button>
              </div>
            </div>
          </div>

          {/* Column 2: Start Date & Shop / Primary Dropdown */}
          <div className="filter-panel-col">
            <div>
              <div className="filter-section-label">
                <Calendar size={13} /> Start Date
              </div>
              <div className="filter-input-wrapper">
                <Calendar size={14} className="filter-input-icon" />
                <input
                  type="date"
                  className="filter-input-dark"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                  }}
                />
              </div>
              <div className="filter-selected-text">
                Selected: {startDate ? startDate : '—'}
              </div>
            </div>

            {dropdown1Options && dropdown1Options.length > 0 && (
              <div>
                <div className="filter-section-label">{dropdown1Label}</div>
                <div className="filter-input-wrapper">
                  <Dropdown1Icon size={14} className="filter-input-icon" />
                  <select
                    className="filter-select-dark"
                    value={dropdown1Value}
                    onChange={(e) => setDropdown1Value(e.target.value)}
                  >
                    {dropdown1Options.map((opt, idx) => {
                      const val = typeof opt === 'object' ? opt.value : opt;
                      const label = typeof opt === 'object' ? opt.label : opt;
                      return (
                        <option key={idx} value={val}>
                          {label}
                        </option>
                      );
                    })}
                  </select>
                  <ChevronDown size={14} className="filter-select-arrow" />
                </div>
              </div>
            )}
          </div>

          {/* Column 3: End Date & Created By / Secondary Dropdown */}
          <div className="filter-panel-col">
            <div>
              <div className="filter-section-label">
                <Calendar size={13} /> End Date
              </div>
              <div className="filter-input-wrapper">
                <Calendar size={14} className="filter-input-icon" />
                <input
                  type="date"
                  className="filter-input-dark"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                  }}
                />
              </div>
              <div className="filter-selected-text">
                Selected: {endDate ? endDate : '—'}
              </div>
            </div>

            {dropdown2Options && dropdown2Options.length > 0 && (
              <div>
                <div className="filter-section-label">{dropdown2Label}</div>
                <div className="filter-input-wrapper">
                  <Dropdown2Icon size={14} className="filter-input-icon" />
                  <select
                    className="filter-select-dark"
                    value={dropdown2Value}
                    onChange={(e) => setDropdown2Value(e.target.value)}
                  >
                    {dropdown2Options.map((opt, idx) => {
                      const val = typeof opt === 'object' ? opt.value : opt;
                      const label = typeof opt === 'object' ? opt.label : opt;
                      return (
                        <option key={idx} value={val}>
                          {label}
                        </option>
                      );
                    })}
                  </select>
                  <ChevronDown size={14} className="filter-select-arrow" />
                </div>
              </div>
            )}

            {extraFields}
          </div>
        </div>
      )}
    </div>
  );
}
