// Constants: Statuses, categories, units, defaults

export const ORDER_STATUSES = {
  DRAFT: 'draft',
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  PROCESSING: 'processing',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
  RETURNED: 'returned',
};

export const PAYMENT_STATUSES = {
  UNPAID: 'unpaid',
  PARTIAL: 'partially_paid',
  PAID: 'paid',
};

export const ORDER_STATUS_LABELS = {
  draft: 'Draft',
  pending: 'Pending',
  confirmed: 'Confirmed',
  processing: 'Processing',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  returned: 'Returned',
};

export const PAYMENT_STATUS_LABELS = {
  unpaid: 'Unpaid',
  partially_paid: 'Partially Paid',
  paid: 'Paid',
};

export const ORDER_STATUS_COLORS = {
  draft: 'gray',
  pending: 'orange',
  confirmed: 'blue',
  processing: 'purple',
  delivered: 'green',
  cancelled: 'red',
  returned: 'yellow',
};

export const PAYMENT_STATUS_COLORS = {
  unpaid: 'red',
  partially_paid: 'orange',
  paid: 'green',
};

export const STOCK_STATUSES = {
  IN_STOCK: 'in_stock',
  LOW_STOCK: 'low_stock',
  OUT_OF_STOCK: 'out_of_stock',
};

export const STOCK_STATUS_LABELS = {
  in_stock: 'In Stock',
  low_stock: 'Low Stock',
  out_of_stock: 'Out of Stock',
};

export const STOCK_STATUS_COLORS = {
  in_stock: 'green',
  low_stock: 'orange',
  out_of_stock: 'red',
};

export const PRODUCT_UNITS = [
  'Piece',
  'Box',
  'Carton',
  'Kg',
  'Liter',
  'Pack',
  'Dozen',
  'Other',
];

export const EXPENSE_CATEGORIES = [
  'Rent',
  'Salary',
  'Fuel',
  'Electricity',
  'Internet',
  'Transport',
  'Marketing',
  'Office',
  'Maintenance',
  'Food',
  'Other',
];

export const PAYMENT_METHODS = [
  'Cash',
  'Bank',
  'Card',
  'Cheque',
  'Online',
  'Other',
];

export const PAYMENT_TYPES = {
  CUSTOMER: 'customer_payment',
  SUPPLIER: 'supplier_payment',
  OTHER: 'other_payment',
};

export const STOCK_MOVEMENT_TYPES = {
  PURCHASE: 'purchase',
  SALE: 'sale',
  RETURN: 'return',
  ADJUSTMENT: 'adjustment',
  CANCEL_RESTORE: 'cancel_restore',
};

export const EMPLOYEE_STATUSES = {
  ACTIVE: 'active',
  DISABLED: 'disabled',
};

export const DEFAULT_PERMISSIONS = {
  createOrders: true,
  editOwnOrders: true,
  cancelOwnOrders: false,
  viewInventory: true,
  createCustomers: true,
  editCustomers: false,
  viewPrices: true,
  recordPayments: false,
  viewCustomerBalance: true,
};

export const PERMISSION_LABELS = {
  createOrders: 'Can Create Orders',
  editOwnOrders: 'Can Edit Own Orders',
  cancelOwnOrders: 'Can Cancel Own Pending Orders',
  viewInventory: 'Can View Inventory',
  createCustomers: 'Can Create Customers',
  editCustomers: 'Can Edit Customers',
  viewPrices: 'Can View Product Prices',
  recordPayments: 'Can Record Payments',
  viewCustomerBalance: 'Can View Customer Balance',
};

export const DATE_RANGES = [
  { label: 'Today', value: 'today' },
  { label: '7 Days', value: '7days' },
  { label: '30 Days', value: '30days' },
  { label: 'This Month', value: 'this_month' },
  { label: 'Last Month', value: 'last_month' },
  { label: 'This Year', value: 'this_year' },
  { label: 'Custom', value: 'custom' },
];

export const DEFAULT_CURRENCY = {
  code: 'PKR',
  symbol: 'Rs',
  name: 'Pakistani Rupee',
};

export const DEFAULT_TIMEZONE = 'Asia/Karachi';

/**
 * Get date range timestamps
 */
export function getDateRange(rangeType) {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
  
  switch (rangeType) {
    case 'today':
      return { start: startOfDay.getTime(), end: endOfDay };
    case '7days':
      return { start: startOfDay.getTime() - 6 * 86400000, end: endOfDay };
    case '30days':
      return { start: startOfDay.getTime() - 29 * 86400000, end: endOfDay };
    case 'this_month': {
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
      return { start: new Date(now.getFullYear(), now.getMonth(), 1).getTime(), end: endOfMonth };
    }
    case 'last_month': {
      const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return { start: firstOfLastMonth.getTime(), end: lastOfLastMonth.getTime() };
    }
    case 'this_year': {
      const endOfYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999).getTime();
      return { start: new Date(now.getFullYear(), 0, 1).getTime(), end: endOfYear };
    }
    case 'all':
      return { start: 0, end: 32503680000000 };
    default:
      return { start: startOfDay.getTime() - 29 * 86400000, end: endOfDay };
  }
}
