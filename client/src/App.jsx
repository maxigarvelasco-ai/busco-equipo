import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import TopHeader from './components/TopHeader';
import Navbar from './components/Navbar';
import Feed from './pages/Feed';
import Login from './pages/Login';
import Register from './pages/Register';
import CreateMatch from './pages/CreateMatch';
import Profile from './pages/Profile';
import UserProfile from './pages/UserProfile';
import Venues from './pages/Venues';
import Tournaments from './pages/Tournaments';
import Subscription from './pages/Subscription';
import MatchDetail from './pages/MatchDetail';
import Notifications from './pages/Notifications';
import Clubs from './pages/Clubs';
import ClubDetail from './pages/ClubDetail';
import Fields from './pages/Fields';
import Support from './pages/Support';
import NotFoundPage from './pages/NotFoundPage';

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
  const { loading } = useAuth();
  
  if (loading) return <div className="loading-spinner"><div className="spinner"></div></div>;

  return (
    <div className="app-layout">
      <Routes>
        <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
        <Route path="/register" element={<GuestRoute><Register /></GuestRoute>} />
        <Route path="/" element={<><TopHeader /><Feed /><Navbar /></>} />
        <Route path="/match/:id" element={<><TopHeader /><MatchDetail /><Navbar /></>} />
        <Route path="/create-match" element={<><TopHeader /><ProtectedRoute><CreateMatch /></ProtectedRoute><Navbar /></>} />
        <Route path="/venues" element={<><TopHeader /><Venues /><Navbar /></>} />
        <Route path="/fields" element={<><TopHeader /><Fields /><Navbar /></>} />
        <Route path="/clubs" element={<><TopHeader /><Clubs /><Navbar /></>} />
        <Route path="/clubs/:id" element={<><TopHeader /><ClubDetail /><Navbar /></>} />
        <Route path="/tournaments" element={<><TopHeader /><Tournaments /><Navbar /></>} />
        <Route path="/subscription" element={<><TopHeader /><ProtectedRoute><Subscription /></ProtectedRoute><Navbar /></>} />
        <Route path="/profile" element={<><TopHeader /><ProtectedRoute><Profile /></ProtectedRoute><Navbar /></>} />
        <Route path="/users/:id" element={<><TopHeader /><ProtectedRoute><UserProfile /></ProtectedRoute><Navbar /></>} />
        <Route path="/notifications" element={<><TopHeader /><ProtectedRoute><Notifications /></ProtectedRoute><Navbar /></>} />
        <Route path="/support" element={<><TopHeader /><ProtectedRoute><Support /></ProtectedRoute><Navbar /></>} />
        <Route path="*" element={<><TopHeader /><NotFoundPage /><Navbar /></>} />
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
