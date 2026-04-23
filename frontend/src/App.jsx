import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AnimatePresence } from 'framer-motion';
import useAuthStore from './store/authStore';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ParkingMapRHL from './pages/ParkingMapRHL';
import ParkingMapContine from './pages/ParkingMapContine';
import ScanPage from './pages/ScanPage';
import SearchPage from './pages/SearchPage';
import AlertsPage from './pages/AlertsPage';
import UserManagementPage from './pages/UserManagementPage';
import VirtualParkingPage from './pages/VirtualParkingPage';
import VirtualMapPage from './pages/VirtualMapPage';
import HistoryPage from './pages/HistoryPage';
import ReportsPage from './pages/ReportsPage';
import ProfilePage from './pages/ProfilePage';
import SettingsPage from './pages/SettingsPage';
import './App.css';

function ProtectedRoute({ children, requiredRole }) {
  const { isAuthenticated, hasRole } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (requiredRole && !hasRole(requiredRole)) return <Navigate to="/dashboard" replace />;
  return children;
}

function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1E1E1E',
            color: '#fff',
            border: '1px solid #2A2A2A',
            fontFamily: 'DM Sans, sans-serif',
          },
        }}
      />
      <AnimatePresence mode="wait">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="map/rhl" element={<ParkingMapRHL />} />
            <Route path="map/contine" element={<ParkingMapContine />} />
            <Route path="map/virtual/:id" element={<VirtualMapPage />} />
            <Route path="scan" element={<ScanPage />} />
            <Route path="search" element={<SearchPage />} />
            <Route path="history" element={<HistoryPage />} />
            <Route path="alerts" element={
              <ProtectedRoute requiredRole="supervisor"><AlertsPage /></ProtectedRoute>
            } />
            <Route path="reports" element={
              <ProtectedRoute requiredRole="supervisor"><ReportsPage /></ProtectedRoute>
            } />
            <Route path="admin/users" element={
              <ProtectedRoute requiredRole="supervisor"><UserManagementPage /></ProtectedRoute>
            } />
            <Route path="admin/virtual" element={
              <ProtectedRoute requiredRole="supervisor"><VirtualParkingPage /></ProtectedRoute>
            } />
            <Route path="admin/settings" element={
              <ProtectedRoute requiredRole="supervisor"><SettingsPage /></ProtectedRoute>
            } />
            <Route path="profile" element={<ProfilePage />} />
          </Route>
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AnimatePresence>
    </BrowserRouter>
  );
}

export default App;
