import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { profilesAPI, subscriptionsAPI } from '../services/api';
import ReportModal from '../components/ReportModal';

export default function Profile() {
  const { user, profile, logout } = useAuth();
  const navigate = useNavigate();
  const [matchesJoined, setMatchesJoined] = useState([]);
  const [matchesAbandoned, setMatchesAbandoned] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showReportModal, setShowReportModal] = useState(false);

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  async function fetchData() {
    try {
      const [joined, abandoned, sub] = await Promise.all([
        profilesAPI.getMatchesJoined(user.id),
        profilesAPI.getMatchesAbandoned(user.id).catch(() => []),
        subscriptionsAPI.getMine().catch(() => null),
      ]);
      setMatchesJoined(joined);
      setMatchesAbandoned(abandoned);
      setSubscription(sub);
    } catch (err) {
      console.error('Error loading profile data:', err);
    } finally {
      setLoading(false);
    }
  }

  if (!user) return null;
  if (!profile) return <div className="page-content"><div className="loading-spinner"><div className="spinner"></div></div></div>;

  const initial = profile.name ? profile.name[0].toUpperCase() : '?';
  const joined = new Date(profile.created_at).toLocaleDateString('es-AR', { year: 'numeric', month: 'long' });
  const isPro = subscription && new Date(subscription.expires_at) > new Date();

  return (
    <div className="page-content">
      <div className="profile-header">
        {profile.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt={profile.name}
            style={{ width: 80, height: 80, borderRadius: '50%', margin: '0 auto var(--space-lg)', objectFit: 'cover', boxShadow: '0 4px 20px rgba(34, 197, 94, 0.3)' }}
          />
        ) : (
          <div className="profile-avatar">{initial}</div>
        )}
        <div className="profile-name">{profile.name}</div>
        <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
          {user.email}
        </div>
        {/* En un caso real mostrarías esto si el perfil es de OTRO usuario */}
        {/* <button className="btn btn-sm btn-secondary" style={{ marginTop: '0.5rem' }} onClick={() => setShowReportModal(true)}>
          🚩 Reportar Usuario
        </button> */}
        {isPro && (
          <span className="badge badge-pro" style={{ marginTop: '0.5rem' }}>⭐ PRO</span>
        )}
        <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)', marginTop: '0.5rem' }}>
          Miembro desde {joined}
        </div>
      </div>

      <div className="profile-stats">
        <div className="stat-card">
          <div className="stat-value">{matchesJoined.length}</div>
          <div className="stat-label">Jugados</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{matchesAbandoned.length}</div>
          <div className="stat-label">Abandonados</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{isPro ? 'Pro' : 'Free'}</div>
          <div className="stat-label">Plan</div>
        </div>
      </div>

      <div style={{ marginTop: 'var(--space-2xl)', display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
        {!isPro && (
          <button className="btn btn-gold btn-lg btn-full" onClick={() => navigate('/subscription')}>
            ⭐ Hacerme Pro
          </button>
        )}

        <button className="btn btn-secondary btn-lg btn-full" onClick={() => navigate('/create-match')}>
          ⚽ Crear Partido
        </button>

        <button className="btn btn-secondary btn-lg btn-full" onClick={() => navigate('/support')}>
          🎧 Centro de Soporte
        </button>

        <button
          className="btn btn-lg btn-full"
          style={{ background: 'transparent', color: 'var(--color-danger)', border: '1px solid rgba(239,68,68,0.3)' }}
          onClick={async () => { await logout(); navigate('/'); }}
        >
          Cerrar Sesión
        </button>
      </div>

      {showReportModal && (
        <ReportModal 
          reportedUserId={profile.id} 
          reportedUserName={profile.name} 
          onClose={() => setShowReportModal(false)} 
        />
      )}
    </div>
  );
}
