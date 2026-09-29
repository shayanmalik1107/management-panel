// Utility: Formatters for currency, dates, numbers

/**
 * Format currency amount
 */
export function formatCurrency(amount, currency = 'Rs', locale = 'en-PK') {
  if (amount === null || amount === undefined || isNaN(amount)) return `${currency} 0`;
  const num = Number(amount);
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Math.abs(num));
  return num < 0 ? `-${currency} ${formatted}` : `${currency} ${formatted}`;
}

/**
 * Format date to readable string
 */
export function formatDate(timestamp, format = 'short') {
  if (!timestamp) return '—';
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return '—';

  if (format === 'short') {
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }
  if (format === 'long') {
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  if (format === 'time') {
    return date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  if (format === 'input') {
    return date.toISOString().split('T')[0];
  }
  return date.toLocaleDateString();
}

/**
 * Format number with commas
 */
export function formatNumber(num) {
  if (num === null || num === undefined || isNaN(num)) return '0';
  return new Intl.NumberFormat('en-PK').format(num);
}

/**
 * Get relative time string
 */
export function timeAgo(timestamp) {
  if (!timestamp) return '';
  const now = Date.now();
  const diff = now - new Date(timestamp).getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return formatDate(timestamp, 'short');
}

/**
 * Generate order/purchase number
 */
export function generateSequentialNumber(prefix, counter) {
  return `${prefix}-${String(counter).padStart(6, '0')}`;
}
