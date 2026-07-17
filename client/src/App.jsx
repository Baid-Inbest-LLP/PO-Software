import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import PrivateRoute from './components/common/PrivateRoute';
import Layout from './components/common/Layout';

const Login = lazy(() => import('./pages/Auth/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const PurchaseOrderList = lazy(() => import('./pages/PurchaseOrders/PurchaseOrderList'));
const CreatePurchaseOrder = lazy(() => import('./pages/PurchaseOrders/CreatePurchaseOrder'));
const PurchaseOrderDetail = lazy(() => import('./pages/PurchaseOrders/PurchaseOrderDetail'));
const Settings = lazy(() => import('./pages/Settings/Settings'));
const ControlCenterPage = lazy(() => import('./pages/control-center/ControlCenterPage'));

const LayoutWrapper = () => (
  <Layout>
    <Outlet />
  </Layout>
);

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={(
            <Suspense
              fallback={(
                <div className="min-h-screen flex items-center justify-center">
                  <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
                </div>
              )}
            >
              <Login />
            </Suspense>
          )}
        />
        <Route path="/register" element={<Navigate to="/login" replace />} />

        <Route element={<PrivateRoute />}>
          <Route element={<LayoutWrapper />}>
            <Route
              path="/"
              element={(
                <Suspense fallback={null}>
                  <Dashboard />
                </Suspense>
              )}
            />
            <Route
              path="/purchase-orders"
              element={(
                <Suspense fallback={null}>
                  <PurchaseOrderList />
                </Suspense>
              )}
            />
            <Route
              path="/purchase-orders/new"
              element={(
                <Suspense fallback={null}>
                  <CreatePurchaseOrder />
                </Suspense>
              )}
            />
            <Route
              path="/purchase-orders/:id"
              element={(
                <Suspense fallback={null}>
                  <PurchaseOrderDetail />
                </Suspense>
              )}
            />
            <Route
              path="/purchase-orders/:id/edit"
              element={(
                <Suspense fallback={null}>
                  <CreatePurchaseOrder />
                </Suspense>
              )}
            />
            <Route
              path="/control-center/*"
              element={(
                <Suspense fallback={null}>
                  <ControlCenterPage />
                </Suspense>
              )}
            />
            <Route path="/companies" element={<Navigate to="/control-center/companies" replace />} />
            <Route path="/vendors" element={<Navigate to="/control-center/vendors" replace />} />
            <Route path="/items" element={<Navigate to="/control-center/items" replace />} />
            <Route
              path="/settings"
              element={(
                <Suspense fallback={null}>
                  <Settings />
                </Suspense>
              )}
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;
