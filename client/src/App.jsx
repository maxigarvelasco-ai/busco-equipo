import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import TopHeader from './components/TopHeader';
import Navbar from './components/Navbar';
import Feed from './pages/Feed';
import Login from './pages/Login';
import Register from './pages/Register';
import CreateMatch from './pages/CreateMatch';
import Profile from './pages/Profile';
import Venues from './pages/Venues';
import Tournaments from './pages/Tournaments';
import Subscription from './pages/Subscription';
import MatchDetail from './pages/MatchDetail';
import Notifications from './pages/Notifications';
import Clubs from './pages/Clubs';
import ClubDetail from './pages/ClubDetail';
import Fields from './pages/Fields';
import Support from './pages/Support';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-spinner"><div className="spinner"></div></div>;
  return user ? children : <Navigate to="/login" />;
}

function GuestRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-spinner"><div className="spinner"></div></div>;
  return user ? <Navigate to="/" /> : children;
}

function AppRoutes() {
  return (
    <div className="app-layout">
      <Routes>
        <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
        <Route path="/register" element={<GuestRoute><Register /></GuestRoute>} />
        <Route path="/*" element={
          <>
            <TopHeader />
            <Routes>
              <Route path="/" element={<Feed />} />
              <Route path="/match/:id" element={<MatchDetail />} />
              <Route path="/create-match" element={<ProtectedRoute><CreateMatch /></ProtectedRoute>} />
              <Route path="/venues" element={<Venues />} />
              <Route path="/fields" element={<Fields />} />
              <Route path="/clubs" element={<Clubs />} />
              <Route path="/clubs/:id" element={<ClubDetail />} />
              <Route path="/tournaments" element={<Tournaments />} />
              <Route path="/subscription" element={<ProtectedRoute><Subscription /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
              <Route path="/support" element={<ProtectedRoute><Support /></ProtectedRoute>} />
            </Routes>
            <Navbar />
          </>
        } />
      </Routes>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
