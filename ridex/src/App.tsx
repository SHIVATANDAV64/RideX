// src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { RideProvider } from './contexts/RideContext';
import { ToastProvider } from './components/ui/Toast';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import ActiveRidePage from './pages/ActiveRidePage';
import DriverDashboard from './pages/DriverDashboard';
import HistoryPage from './pages/HistoryPage';
import PaymentCancelPage from './pages/PaymentCancelPage';
import PaymentSuccessPage from './pages/PaymentSuccessPage';
import ProfilePage from './pages/ProfilePage';
import RatePage from './pages/RatePage';
import PaymentMethodsPage from './pages/PaymentMethodsPage';
import SafetyPage from './pages/SafetyPage';
import SupportPage from './pages/SupportPage';
import AdminPage from './pages/AdminPage';
import { type ReactNode } from 'react';

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <SplashScreen />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, isAdmin, loading } = useAuth();
  if (loading) return <SplashScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/profile" replace />;
  return <>{children}</>;
}

function SplashScreen() {
  return (
    <div className="min-h-dvh bg-surface flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-black tracking-tight text-white mb-3">
          Ride<span className="text-brand">X</span>
        </h1>
        <span className="flex gap-1.5 justify-center">
          {[1, 2, 3].map(i => (
            <span key={i} className={`w-2 h-2 rounded-full bg-brand dot-${i}`} />
          ))}
        </span>
      </div>
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/home" element={<RequireAuth><HomePage /></RequireAuth>} />
      <Route path="/ride" element={<RequireAuth><ActiveRidePage /></RequireAuth>} />
      <Route path="/payment/stripe/success" element={<RequireAuth><PaymentSuccessPage /></RequireAuth>} />
      <Route path="/payment/stripe/cancel" element={<RequireAuth><PaymentCancelPage /></RequireAuth>} />
      <Route path="/rate" element={<RequireAuth><RatePage /></RequireAuth>} />
      <Route path="/history" element={<RequireAuth><HistoryPage /></RequireAuth>} />
      <Route path="/profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
      <Route path="/profile/payment-methods" element={<RequireAuth><PaymentMethodsPage /></RequireAuth>} />
      <Route path="/profile/safety" element={<RequireAuth><SafetyPage /></RequireAuth>} />
      <Route path="/support" element={<RequireAuth><SupportPage /></RequireAuth>} />
      <Route path="/admin" element={<RequireAdmin><AdminPage /></RequireAdmin>} />
      <Route path="/driver" element={<RequireAuth><DriverDashboard /></RequireAuth>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <RideProvider>
          <ToastProvider>
            <AppRoutes />
          </ToastProvider>
        </RideProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
