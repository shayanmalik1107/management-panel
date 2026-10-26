import { useState, useEffect } from 'react';
import { ref, update, get, remove } from 'firebase/database';
import { database } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { Sparkles, Trash2, CheckCircle2, Box, Database, RefreshCw, AlertCircle } from 'lucide-react';

export default function DemoDataManager() {
  const { companyId } = useAuth();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [hasDemoData, setHasDemoData] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!companyId) return;
    const checkRef = ref(database, `companies/${companyId}/isDemoDataActive`);
    get(checkRef).then((snap) => {
      setHasDemoData(snap.exists() && snap.val() === true);
      setChecking(false);
    }).catch(() => setChecking(false));
  }, [companyId]);

  if (!companyId || checking) return null;

  const handleLoadDemoData = async () => {
    setLoading(true);
    try {
      const now = Date.now();
      const updates = {};

      // 1. Five Sample Products
      const demoProducts = {
        demo_prod_1: {
          name: 'Super Basmati Rice 5kg',
          sku: 'DEMO-101',
          costPrice: 1350,
          salePrice: 1650,
          price: 1650,
          stockQuantity: 25,
          quantity: 25,
          unit: 'bag',
          category: 'Grains & Pulses',
          lowStockThreshold: 10,
          isDemo: true,
          createdAt: now,
        },
        demo_prod_2: {
          name: 'Premium Cooking Oil 5L',
          sku: 'DEMO-102',
          costPrice: 2400,
          salePrice: 2850,
          price: 2850,
          stockQuantity: 3,
          quantity: 3,
          unit: 'can',
          category: 'Cooking Essentials',
          lowStockThreshold: 10, // Critical low stock
          isDemo: true,
          createdAt: now,
        },
        demo_prod_3: {
          name: 'Organic Green Tea Pack (100g)',
          sku: 'DEMO-103',
          costPrice: 480,
          salePrice: 650,
          price: 650,
          stockQuantity: 42,
          quantity: 42,
          unit: 'pack',
          category: 'Beverages',
          lowStockThreshold: 10,
          isDemo: true,
          createdAt: now,
        },
        demo_prod_4: {
          name: 'Full Cream Milk Carton (12x1L)',
          sku: 'DEMO-104',
          costPrice: 2750,
          salePrice: 3200,
          price: 3200,
          stockQuantity: 2,
          quantity: 2,
          unit: 'carton',
          category: 'Dairy',
          lowStockThreshold: 8, // Critical low stock
          isDemo: true,
          createdAt: now,
        },
        demo_prod_5: {
          name: 'Arabica Coffee Beans 1kg',
          sku: 'DEMO-105',
          costPrice: 3400,
          salePrice: 4200,
          price: 4200,
          stockQuantity: 15,
          quantity: 15,
          unit: 'pack',
          category: 'Beverages',
          lowStockThreshold: 5,
          isDemo: true,
          createdAt: now,
        },
      };

      // 2. Three Sample Customers
      const demoCustomers = {
        demo_cust_1: {
          name: 'Ahmed Bilal Superstore',
          phone: '03001234567',
          email: 'ahmed.bilal@example.com',
          address: 'Main Market, Gulberg Lahore',
          balance: 18500, // Pending Debt
          currentBalance: 18500,
          totalPurchases: 32000,
          isDemo: true,
          createdAt: now,
        },
        demo_cust_2: {
          name: 'Farhan Traders',
          phone: '03129876543',
          email: 'farhan.traders@example.com',
          address: 'Commercial Zone, Karachi',
          balance: 9200, // Pending Debt
          currentBalance: 9200,
          totalPurchases: 18400,
          isDemo: true,
          createdAt: now,
        },
        demo_cust_3: {
          name: 'Zainab Cash & Carry',
          phone: '03335551234',
          email: 'zainab.cash@example.com',
          address: 'F-10 Markaz, Islamabad',
          balance: 0,
          currentBalance: 0,
          totalPurchases: 45000,
          isDemo: true,
          createdAt: now,
        },
      };

      // 3. Four Sample Orders
      const demoOrders = {
        demo_ord_1: {
          orderNumber: 'ORD-1001',
          customerId: 'demo_cust_3',
          customerName: 'Zainab Cash & Carry',
          grandTotal: 12800,
          total: 12800,
          amountPaid: 12800,
          paymentStatus: 'paid',
          status: 'completed',
          items: [
            { productId: 'demo_prod_1', name: 'Super Basmati Rice 5kg', quantity: 4, price: 1650, total: 6600 },
            { productId: 'demo_prod_4', name: 'Full Cream Milk Carton (12x1L)', quantity: 2, price: 3100, total: 6200 },
          ],
          isDemo: true,
          createdAt: now - 3600000, // 1 hour ago
        },
        demo_ord_2: {
          orderNumber: 'ORD-1002',
          customerId: 'demo_cust_1',
          customerName: 'Ahmed Bilal Superstore',
          grandTotal: 18500,
          total: 18500,
          amountPaid: 0,
          paymentStatus: 'unpaid',
          status: 'completed',
          items: [
            { productId: 'demo_prod_2', name: 'Premium Cooking Oil 5L', quantity: 5, price: 2850, total: 14250 },
            { productId: 'demo_prod_5', name: 'Arabica Coffee Beans 1kg', quantity: 1, price: 4250, total: 4250 },
          ],
          isDemo: true,
          createdAt: now - 7200000, // 2 hours ago
        },
        demo_ord_3: {
          orderNumber: 'ORD-1003',
          customerId: 'demo_cust_2',
          customerName: 'Farhan Traders',
          grandTotal: 9200,
          total: 9200,
          amountPaid: 0,
          paymentStatus: 'unpaid',
          status: 'completed',
          items: [
            { productId: 'demo_prod_3', name: 'Organic Green Tea Pack (100g)', quantity: 8, price: 650, total: 5200 },
            { productId: 'demo_prod_1', name: 'Super Basmati Rice 5kg', quantity: 2, price: 2000, total: 4000 },
          ],
          isDemo: true,
          createdAt: now - 1800000, // 30 mins ago
        },
        demo_ord_4: {
          orderNumber: 'ORD-1004',
          customerId: 'demo_cust_3',
          customerName: 'Zainab Cash & Carry',
          grandTotal: 6400,
          total: 6400,
          amountPaid: 6400,
          paymentStatus: 'paid',
          status: 'completed',
          items: [
            { productId: 'demo_prod_4', name: 'Full Cream Milk Carton (12x1L)', quantity: 2, price: 3200, total: 6400 },
          ],
          isDemo: true,
          createdAt: now - 900000, // 15 mins ago
        },
      };

      // Set items in Firebase
      Object.entries(demoProducts).forEach(([id, p]) => {
        updates[`companies/${companyId}/products/${id}`] = p;
      });
      Object.entries(demoCustomers).forEach(([id, c]) => {
        updates[`companies/${companyId}/customers/${id}`] = c;
      });
      Object.entries(demoOrders).forEach(([id, o]) => {
        updates[`companies/${companyId}/orders/${id}`] = o;
      });
      updates[`companies/${companyId}/isDemoDataActive`] = true;

      await update(ref(database), updates);
      setHasDemoData(true);
      toast.success('🎉 Sample Demo Data loaded! Products, sales, and ledgers are now active.');
    } catch (err) {
      console.error('Failed to load demo data:', err);
      toast.error('Failed to load demo data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClearDemoData = async () => {
    if (!window.confirm('Are you sure you want to delete all sample demo data? Any real products you created will be preserved.')) {
      return;
    }

    setLoading(true);
    try {
      const updates = {};
      const demoKeys = [
        'products/demo_prod_1', 'products/demo_prod_2', 'products/demo_prod_3', 'products/demo_prod_4', 'products/demo_prod_5',
        'customers/demo_cust_1', 'customers/demo_cust_2', 'customers/demo_cust_3',
        'orders/demo_ord_1', 'orders/demo_ord_2', 'orders/demo_ord_3', 'orders/demo_ord_4',
      ];

      demoKeys.forEach(k => {
        updates[`companies/${companyId}/${k}`] = null;
      });
      updates[`companies/${companyId}/isDemoDataActive`] = null;

      await update(ref(database), updates);
      setHasDemoData(false);
      toast.success('Sample demo data successfully cleared.');
    } catch (err) {
      console.error('Failed to clear demo data:', err);
      toast.error('Failed to clear demo data.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      background: hasDemoData
        ? 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)'
        : 'linear-gradient(135deg, #eff6ff 0%, #e0e7ff 100%)',
      borderRadius: 16,
      border: hasDemoData ? '1px solid #86efac' : '1px solid #bfdbfe',
      padding: '16px 20px',
      marginBottom: 24,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
      flexWrap: 'wrap',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.03)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: hasDemoData ? '#16a34a' : '#2563eb',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          boxShadow: hasDemoData
            ? '0 4px 12px rgba(22, 163, 74, 0.3)'
            : '0 4px 12px rgba(37, 99, 235, 0.3)',
        }}>
          {hasDemoData ? <Database size={22} /> : <Sparkles size={22} />}
        </div>

        <div>
          <div style={{
            fontSize: 14,
            fontWeight: 800,
            color: hasDemoData ? '#166534' : '#1e40af',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            {hasDemoData ? 'Sample Demo Data is Active' : '1-Click Demo Data Creator'}
            <span style={{
              fontSize: 11,
              fontWeight: 700,
              background: hasDemoData ? '#bbf7d0' : '#dbeafe',
              color: hasDemoData ? '#14532d' : '#1e3a8a',
              padding: '2px 8px',
              borderRadius: 12,
            }}>
              {hasDemoData ? '5 Products • 3 Customers • 4 Orders' : 'Test Mode'}
            </span>
          </div>
          <div style={{ fontSize: 12, color: hasDemoData ? '#15803d' : '#475569', marginTop: 2 }}>
            {hasDemoData
              ? 'Sample products, low stock items, and customer ledger balances are active for testing graphs and LAMBA Voice AI.'
              : 'Populate sample products, orders, and customer debt ledgers with one click to test invoices, reports, and the AI Assistant!'}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {hasDemoData ? (
          <button
            disabled={loading}
            onClick={handleClearDemoData}
            style={{
              background: '#ef4444',
              color: '#ffffff',
              border: 'none',
              borderRadius: 10,
              padding: '9px 16px',
              fontSize: 13,
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 2px 8px rgba(239, 68, 68, 0.25)',
              transition: 'all 0.15s ease',
            }}
          >
            <Trash2 size={15} /> {loading ? 'Clearing...' : 'Clear Demo Data'}
          </button>
        ) : (
          <button
            disabled={loading}
            onClick={handleLoadDemoData}
            style={{
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: 10,
              padding: '10px 18px',
              fontSize: 13,
              fontWeight: 800,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
              transition: 'all 0.15s ease',
            }}
          >
            <Sparkles size={16} /> {loading ? 'Loading Demo Data...' : 'Load Sample Demo Data'}
          </button>
        )}
      </div>
    </div>
  );
}
