import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ProtectedRoute, PublicRoute, AdminRoute } from './components/auth/ProtectedRoute';

// Layout
import AppLayout from './components/layout/AppLayout';

// Auth Pages
import LoginPage from './components/auth/LoginPage';
import RegisterPage from './components/auth/RegisterPage';
import WelcomeScreen from './components/auth/WelcomeScreen';
import SelectCompanyPage from './components/auth/SelectCompanyPage';

// Dashboards
import AdminDashboard from './components/dashboard/AdminDashboard';
import EmployeeDashboard from './components/dashboard/EmployeeDashboard';

// Business Modules
import OrdersList from './components/orders/OrdersList';
import CreateOrder from './components/orders/CreateOrder';
import OrderDetails from './components/orders/OrderDetails';
import CustomersList from './components/customers/CustomersList';
import CustomerProfile from './components/customers/CustomerProfile';
import CustomerForm from './components/customers/CustomerForm';
import ProductsList from './components/products/ProductsList';
import ProductProfile from './components/products/ProductProfile';
import ProductForm from './components/products/ProductForm';
import InventoryPage from './components/inventory/InventoryPage';

// Finance
import PurchasesList from './components/purchases/PurchasesList';
import CreatePurchase from './components/purchases/CreatePurchase';
import ExpensesList from './components/expenses/ExpensesList';
import ExpenseForm from './components/expenses/ExpenseForm';
import PaymentsList from './components/payments/PaymentsList';
import CreatePayment from './components/payments/CreatePayment';
import CreateCustomerPayment from './components/payments/CreateCustomerPayment';
import LedgerPage from './components/ledger/LedgerPage';
import SalesPage from './components/sales/SalesPage';

// Analytics & Reports
import ProfitLossPage from './components/profitLoss/ProfitLossPage';
import ReportsPage from './components/reports/ReportsPage';

// Team & Settings
import EmployeesList from './components/employees/EmployeesList';
import EmployeeProfile from './components/employees/EmployeeProfile';
import SettingsPage from './components/settings/SettingsPage';
import TutorialsPage from './components/tutorials/TutorialsPage';

/**
 * Fast synchronous router for Dashboard
 * Redirects admin directly to company selection if not yet selected in session
 */
function DashboardRouter() {
  const { isAdmin, companyId } = useAuth();

  if (isAdmin) {
    const isSelected = sessionStorage.getItem('company_selected') === 'true';
    if (!isSelected || !companyId) {
      return <Navigate to="/select-company" replace />;
    }
    return <AdminDashboard />;
  }

  return <EmployeeDashboard />;
}


function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public / Auth Routes */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          
          <Route path="/login" element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          } />
          
          <Route path="/register" element={
            <PublicRoute>
              <RegisterPage />
            </PublicRoute>
          } />

          {/* Standalone Company Selection Screen */}
          <Route path="/select-company" element={
            <ProtectedRoute>
              <AdminRoute>
                <SelectCompanyPage />
              </AdminRoute>
            </ProtectedRoute>
          } />

          <Route path="/setup" element={
            <ProtectedRoute>
              <AdminDashboard />
            </ProtectedRoute>
          } />

          <Route path="/welcome" element={
            <ProtectedRoute>
              <AdminRoute>
                <WelcomeScreen />
              </AdminRoute>
            </ProtectedRoute>
          } />

          {/* Main App Layout Protected Sub-Routes */}
          <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route path="/dashboard" element={<DashboardRouter />} />
            
            {/* Orders */}
            <Route path="/orders" element={<OrdersList />} />
            <Route path="/orders/new" element={<CreateOrder />} />
            <Route path="/orders/:id/edit" element={<CreateOrder />} />
            <Route path="/orders/:id" element={<OrderDetails />} />
            
            {/* Customers & Products */}
            <Route path="/customers" element={<CustomersList />} />
            <Route path="/customers/new" element={<CustomerForm />} />
            <Route path="/customers/:id/edit" element={<CustomerForm />} />
            <Route path="/customers/:id" element={<CustomerProfile />} />
            <Route path="/products" element={<ProductsList />} />
            <Route path="/products/new" element={<ProductForm />} />
            <Route path="/products/:id/edit" element={<ProductForm />} />
            <Route path="/products/:id" element={<ProductProfile />} />
            
            {/* Tutorials */}
            <Route path="/tutorials" element={<TutorialsPage />} />

            {/* Admin Only Routes */}
            <Route path="/inventory" element={<AdminRoute><InventoryPage /></AdminRoute>} />
            <Route path="/purchases" element={<AdminRoute><PurchasesList /></AdminRoute>} />
            <Route path="/purchases/new" element={<AdminRoute><CreatePurchase /></AdminRoute>} />
            <Route path="/expenses" element={<AdminRoute><ExpensesList /></AdminRoute>} />
            <Route path="/expenses/new" element={<AdminRoute><ExpenseForm /></AdminRoute>} />
            <Route path="/payments" element={<AdminRoute><PaymentsList /></AdminRoute>} />
            <Route path="/payments/new" element={<AdminRoute><CreatePayment /></AdminRoute>} />
            <Route path="/payments/customer-new" element={<AdminRoute><CreateCustomerPayment /></AdminRoute>} />
            <Route path="/ledger" element={<AdminRoute><LedgerPage /></AdminRoute>} />
            <Route path="/sales" element={<AdminRoute><SalesPage /></AdminRoute>} />
            <Route path="/profit-loss" element={<AdminRoute><ProfitLossPage /></AdminRoute>} />
            <Route path="/reports" element={<AdminRoute><ReportsPage /></AdminRoute>} />
            <Route path="/employees" element={<AdminRoute><EmployeesList /></AdminRoute>} />
            <Route path="/employees/:id" element={<AdminRoute><EmployeeProfile /></AdminRoute>} />
            <Route path="/settings" element={<AdminRoute><SettingsPage /></AdminRoute>} />
          </Route>

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
