import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { tournamentsAPI, subscriptionsAPI } from '../services/api';

export default function Tournaments() {
  const { user } = useAuth();
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [registerModal, setRegisterModal] = useState(null);
  const [teamName, setTeamName] = useState('');
  const [toast, setToast] = useState(null);
  const [isPro, setIsPro] = useState(false);

  const [form, setForm] = useState({
    name: '', football_type: 5, start_date: '', max_teams: 8, entry_price: 0, city: '', zone: '', visibility: 'public', format: '', prize: '', registration_deadline: '', description: ''
  });

  useEffect(() => {
    fetchTournaments();
    checkPro();
  }, []);

  async function fetchTournaments() {
    try {
      const data = await tournamentsAPI.getAll();
      setTournaments(data);
    } catch (err) {
      console.error('Error loading tournaments:', err);
    } finally {
      setLoading(false);
    }
  }

  async function checkPro() {
    try {
      const sub = await subscriptionsAPI.getMine();
      setIsPro(sub && new Date(sub.expires_at) > new Date());
    } catch { }
  }

  const showToast = (msg, type = 'success') => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await tournamentsAPI.create({
        name: form.name,
        football_type: parseInt(form.football_type),
        start_date: form.start_date,
        max_teams: parseInt(form.max_teams),
        entry_price: parseFloat(form.entry_price) || 0,
        city: form.city || null,
        zone: form.zone || null,
        visibility: form.visibility,
        format: form.format || null,
        prize: form.prize || null,
        registration_deadline: form.registration_deadline || null,
        description: form.description || null,
      });
      showToast('¡Torneo creado!');
      setShowCreate(false);
      fetchTournaments();
    } catch (err) {
      showToast(err.message || 'Error al crear torneo', 'error');
    }
  };

  const handleRegister = async () => {
    if (!teamName.trim()) return;
    try {
      await tournamentsAPI.registerTeam(registerModal.id, teamName);
      showToast('¡Equipo registrado!');
      setRegisterModal(null);
      setTeamName('');
      fetchTournaments();
    } catch (err) {
      showToast(err.message || 'Error al registrar equipo', 'error');
    }
  };

  return (
    <div className="page-content">
      {toast && <div className={`toast toast-${toast.type}`}>{toast.message}</div>}

      <div className="page-header">
        <h1 className="page-title">Torneos</h1>
        {isPro && (
          <button className="btn btn-sm btn-primary" onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? '✕ Cerrar' : '+ Crear'}
          </button>
        )}
      </div>

      {showCreate && (
        <div className="card" style={{ marginBottom: 'var(--space-xl)' }}>
          <h3 style={{ marginBottom: 'var(--space-lg)' }}>Nuevo Torneo</h3>
          <form onSubmit={handleCreate}>
            <div className="form-group">
              <label className="form-label">Nombre del torneo</label>
              <input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Tipo</label>
                <select className="form-select" value={form.football_type} onChange={e => setForm({ ...form, football_type: e.target.value })}>
                  <option value="5">Fútbol 5</option>
                  <option value="7">Fútbol 7</option>
                  <option value="11">Fútbol 11</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Fecha</label>
                <input type="date" className="form-input" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} required />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Equipos máx.</label>
                <input type="number" className="form-input" value={form.max_teams} onChange={e => setForm({ ...form, max_teams: e.target.value })} min="2" required />
              </div>
              <div className="form-group">
                <label className="form-label">Inscripción (ARS)</label>
                <input type="number" className="form-input" value={form.entry_price} onChange={e => setForm({ ...form, entry_price: e.target.value })} min="0" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Ciudad</label>
                <input className="form-input" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Zona</label>
                <input className="form-input" value={form.zone} onChange={e => setForm({ ...form, zone: e.target.value })} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Visibilidad</label>
                <select className="form-select" value={form.visibility} onChange={e => setForm({ ...form, visibility: e.target.value })}>
                  <option value="public">Público</option>
                  <option value="private">Privado</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Formato</label>
                <input className="form-input" value={form.format} onChange={e => setForm({ ...form, format: e.target.value })} placeholder="Liga / Copa / Eliminación" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Premio</label>
                <input className="form-input" value={form.prize} onChange={e => setForm({ ...form, prize: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Cierre inscripción</label>
                <input type="date" className="form-input" value={form.registration_deadline} onChange={e => setForm({ ...form, registration_deadline: e.target.value })} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Descripción</label>
              <textarea className="form-textarea" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
            <button type="submit" className="btn btn-primary btn-full">Crear Torneo</button>
          </form>
        </div>
      )}

      {loading ? (
        <div className="loading-spinner"><div className="spinner"></div></div>
      ) : tournaments.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🏆</div>
          <div className="empty-state-title">No hay torneos disponibles</div>
          <p style={{ color: 'var(--color-text-muted)' }}>Los organizadores Pro pueden crear torneos</p>
        </div>
      ) : (
        tournaments.map(t => (
          <div key={t.id} className="card tournament-card animate-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div className="tournament-name">🏆 {t.name}</div>
                <div className="match-info">
                  <div className="match-info-row"><span className="info-icon">⚽</span><span>Fútbol {t.football_type}</span></div>
                  <div className="match-info-row"><span className="info-icon">📅</span><span>{new Date(t.start_date).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}</span></div>
                  <div className="match-info-row"><span className="info-icon">👥</span><span>{t.teams_registered}/{t.max_teams} equipos</span></div>
                  {(t.city || t.zone) && <div className="match-info-row"><span className="info-icon">📌</span><span>{[t.city, t.zone].filter(Boolean).join(' · ')}</span></div>}
                  {t.format && <div className="match-info-row"><span className="info-icon">🧩</span><span>{t.format}</span></div>}
                  {t.prize && <div className="match-info-row"><span className="info-icon">🏅</span><span>{t.prize}</span></div>}
                  {t.organizer_name && <div className="match-info-row"><span className="info-icon">👤</span><span>Organiza: {t.organizer_name}</span></div>}
                </div>
              </div>
              {t.entry_price > 0 && (
                <div className="tournament-entry">${t.entry_price.toLocaleString()}</div>
              )}
            </div>
            <div style={{ marginTop: '1rem' }}>
              <button className="btn btn-primary btn-sm" onClick={() => user ? setRegisterModal(t) : null}>
                Inscribir Equipo
              </button>
            </div>
          </div>
        ))
      )}

      {/* Register Team Modal */}
      {registerModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="card" style={{ maxWidth: '400px', width: '100%' }}>
            <h3 style={{ marginBottom: '1rem' }}>Inscribir en {registerModal.name}</h3>
            <div className="form-group">
              <label className="form-label">Nombre del equipo</label>
              <input className="form-input" value={teamName} onChange={e => setTeamName(e.target.value)} placeholder="Ej: Los Cracks" />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-primary btn-full" onClick={handleRegister}>Inscribir</button>
              <button className="btn btn-secondary" onClick={() => { setRegisterModal(null); setTeamName(''); }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
