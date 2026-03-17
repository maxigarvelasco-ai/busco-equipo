import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { profilesAPI, subscriptionsAPI } from '../services/api';
import ReportModal from '../components/ReportModal';

export default function Profile() {
  const { user, profile, logout, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [matchesJoined, setMatchesJoined] = useState([]);
  const [matchesAbandoned, setMatchesAbandoned] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [showReportModal, setShowReportModal] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    age: '',
    gender: 'masculino',
    city: '',
    zone: '',
    preferred_position: '',
    preferred_foot: '',
    bio: '',
    phone: '',
    is_profile_public: true,
  });

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  useEffect(() => {
    if (!profile) return;
    setEditForm({
      name: profile.name || '',
      age: profile.age || '',
      gender: profile.gender || 'masculino',
      city: profile.city || '',
      zone: profile.zone || '',
      preferred_position: profile.preferred_position || '',
      preferred_foot: profile.preferred_foot || '',
      bio: profile.bio || '',
      phone: profile.phone || '',
      is_profile_public: profile.is_profile_public !== false,
    });
  }, [profile]);

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

  async function handleSaveProfile(e) {
    e.preventDefault();
    setSaveMsg('');
    setSaving(true);
    try {
      const updates = {
        name: editForm.name,
        age: editForm.age ? parseInt(editForm.age) : null,
        gender: editForm.gender || null,
        city: editForm.city || null,
        zone: editForm.zone || null,
        preferred_position: editForm.preferred_position || null,
        preferred_foot: editForm.preferred_foot || null,
        bio: editForm.bio || null,
        phone: editForm.phone || null,
        is_profile_public: !!editForm.is_profile_public,
      };
      const { error } = await updateProfile(updates);
      if (error) throw error;
      setSaveMsg('Perfil actualizado');
      setTimeout(() => setSaveMsg(''), 2500);
    } catch (err) {
      setSaveMsg(err.message || 'No se pudo guardar');
    } finally {
      setSaving(false);
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

      <div className="card" style={{ marginTop: 'var(--space-xl)' }}>
        <h3 style={{ marginBottom: '0.8rem' }}>Mi ficha de jugador</h3>
        <form onSubmit={handleSaveProfile} style={{ display: 'grid', gap: '0.75rem' }}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Nombre</label>
              <input className="form-input" value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} required />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Edad</label>
              <input type="number" min="13" max="90" className="form-input" value={editForm.age} onChange={(e) => setEditForm((p) => ({ ...p, age: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label className="form-label">Sexo</label>
              <select className="form-select" value={editForm.gender} onChange={(e) => setEditForm((p) => ({ ...p, gender: e.target.value }))} required>
                <option value="masculino">Masculino</option>
                <option value="femenino">Femenino</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Ciudad</label>
              <input className="form-input" value={editForm.city} onChange={(e) => setEditForm((p) => ({ ...p, city: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Zona</label>
              <input className="form-input" value={editForm.zone} onChange={(e) => setEditForm((p) => ({ ...p, zone: e.target.value }))} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Posición</label>
              <input className="form-input" value={editForm.preferred_position} onChange={(e) => setEditForm((p) => ({ ...p, preferred_position: e.target.value }))} placeholder="Ej: Volante" />
            </div>
            <div className="form-group">
              <label className="form-label">Pierna hábil</label>
              <select className="form-select" value={editForm.preferred_foot} onChange={(e) => setEditForm((p) => ({ ...p, preferred_foot: e.target.value }))}>
                <option value="">No definido</option>
                <option value="left">Zurda</option>
                <option value="right">Derecha</option>
                <option value="both">Ambas</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Bio</label>
            <textarea className="form-textarea" value={editForm.bio} onChange={(e) => setEditForm((p) => ({ ...p, bio: e.target.value }))} />
          </div>

          <div className="form-group">
            <label className="form-label">Teléfono</label>
            <input className="form-input" value={editForm.phone} onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))} />
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input type="checkbox" checked={editForm.is_profile_public} onChange={(e) => setEditForm((p) => ({ ...p, is_profile_public: e.target.checked }))} />
            Permitir que otros encuentren mi perfil
          </label>

          {saveMsg && <div style={{ color: saveMsg === 'Perfil actualizado' ? 'var(--color-primary)' : 'var(--color-danger)', fontSize: '0.85rem' }}>{saveMsg}</div>}

          <button type="submit" className="btn btn-primary btn-full" disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar perfil'}
          </button>
        </form>
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
