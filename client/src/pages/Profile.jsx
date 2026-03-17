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
  const [isEditingFicha, setIsEditingFicha] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [editForm, setEditForm] = useState({
    name: '',
    birth_date: '',
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
      birth_date: profile.birth_date || '',
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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.location.hash !== '#buscar-perfiles') return;
    const section = document.getElementById('buscar-perfiles');
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
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
      const birth = new Date(editForm.birth_date);
      if (Number.isNaN(birth.getTime())) {
        throw new Error('Ingresá una fecha de nacimiento válida');
      }
      const computedAge = Math.floor((Date.now() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
      if (computedAge < 13 || computedAge > 90) {
        throw new Error('La fecha de nacimiento debe dar una edad entre 13 y 90 años');
      }

      const updates = {
        name: editForm.name,
        birth_date: editForm.birth_date || null,
        age: computedAge,
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
      setIsEditingFicha(false);
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

  async function handleSearchProfiles(e) {
    e.preventDefault();
    const q = searchTerm.trim();
    if (!q) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const list = await profilesAPI.searchProfiles(q, user.id);
      setSearchResults(list || []);
    } catch (err) {
      console.error('Error searching profiles:', err);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }

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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
          <h3>Mi ficha de jugador</h3>
          {!isEditingFicha ? (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsEditingFicha(true)}>
              Editar ficha
            </button>
          ) : (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsEditingFicha(false)}>
              Cancelar
            </button>
          )}
        </div>

        {!isEditingFicha ? (
          <div style={{ display: 'grid', gap: '0.6rem' }}>
            <div className="match-info-row"><span className="info-icon">🧍</span><span><strong>Nombre:</strong> {profile.name || '-'}</span></div>
            <div className="match-info-row"><span className="info-icon">🎂</span><span><strong>Nacimiento:</strong> {profile.birth_date ? new Date(profile.birth_date).toLocaleDateString('es-AR') : '-'}</span></div>
            <div className="match-info-row"><span className="info-icon">⚧️</span><span><strong>Sexo:</strong> {profile.gender || '-'}</span></div>
            <div className="match-info-row"><span className="info-icon">📍</span><span><strong>Ciudad/Zona:</strong> {[profile.city, profile.zone].filter(Boolean).join(' - ') || '-'}</span></div>
            <div className="match-info-row"><span className="info-icon">⚽</span><span><strong>Posición:</strong> {profile.preferred_position || '-'}</span></div>
            <div className="match-info-row"><span className="info-icon">🦶</span><span><strong>Pierna hábil:</strong> {profile.preferred_foot || '-'}</span></div>
            <div className="match-info-row"><span className="info-icon">📝</span><span><strong>Bio:</strong> {profile.bio || '-'}</span></div>
            <div className="match-info-row"><span className="info-icon">📞</span><span><strong>Teléfono:</strong> {profile.phone || '-'}</span></div>
          </div>
        ) : (
        <form onSubmit={handleSaveProfile} style={{ display: 'grid', gap: '0.75rem' }}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Nombre</label>
              <input className="form-input" value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} required />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Fecha de nacimiento</label>
              <input type="date" className="form-input" value={editForm.birth_date} onChange={(e) => setEditForm((p) => ({ ...p, birth_date: e.target.value }))} required />
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
        )}
      </div>

      <div id="buscar-perfiles" className="card" style={{ marginTop: 'var(--space-xl)' }}>
        <h3 style={{ marginBottom: '0.8rem' }}>Buscar perfiles</h3>
        <form onSubmit={handleSearchProfiles} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.8rem' }}>
          <input
            className="form-input"
            style={{ flex: 1 }}
            placeholder="Nombre, ciudad o zona"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button className="btn btn-primary" type="submit" disabled={searching}>
            {searching ? 'Buscando...' : 'Buscar'}
          </button>
        </form>

        {searchResults.length > 0 ? (
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {searchResults.map((p) => (
              <div key={p.id} className="card" style={{ padding: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{p.name || 'Sin nombre'}</div>
                  <div style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>{[p.city, p.zone].filter(Boolean).join(' - ') || 'Sin ubicación'}</div>
                </div>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <button className="btn btn-secondary btn-sm" type="button" onClick={() => navigate(`/users/${p.id}`)}>
                    Ver ficha
                  </button>
                  <button className="btn btn-primary btn-sm" type="button" onClick={() => navigate(`/users/${p.id}`)}>
                    Mensaje
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: 'var(--color-text-muted)' }}>Buscá jugadores para ver su ficha y chatear en tiempo real.</p>
        )}
      </div>

      <div className="profile-actions">
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
