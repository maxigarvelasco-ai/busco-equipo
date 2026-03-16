import { useState, useEffect } from 'react';
import { clubsAPI } from '../services/api';
import { userTeamsAPI } from '../services/api';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Clubs() {
  const [clubs, setClubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState([]);
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    loadClubs();
  }, []);

  const loadClubs = async () => {
    try {
      setLoading(true);
      const [data, teamData] = await Promise.all([
        clubsAPI.getAll(),
        userTeamsAPI.getAll({ is_recruiting: true }).catch(() => []),
      ]);
      setClubs(data);
      setTeams(teamData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const [showCreate, setShowCreate] = useState(false);
  const [newClub, setNewClub] = useState({ name: '', city: '', description: '' });
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [newTeam, setNewTeam] = useState({ name: '', city: '', zone: '', football_type: '5', description: '', is_recruiting: true });

  useEffect(() => {
    if (location.state?.openCreateTeam) {
      setShowCreateTeam(true);
    }
    if (location.state?.openCreateClub) {
      setShowCreate(true);
    }
  }, [location.state]);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await clubsAPI.create(newClub);
      setShowCreate(false);
      setNewClub({ name: '', city: '', description: '' });
      loadClubs();
    } catch (err) {
      alert(err.message || 'Error al crear');
    }
  };

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    try {
      await userTeamsAPI.create(newTeam);
      setShowCreateTeam(false);
      setNewTeam({ name: '', city: '', zone: '', football_type: '5', description: '', is_recruiting: true });
      loadClubs();
    } catch (err) {
      alert(err.message || 'Error al crear equipo');
    }
  };

  const handleRequestJoinTeam = async (teamId) => {
    if (!user) {
      navigate('/login');
      return;
    }
    try {
      await userTeamsAPI.requestJoin(teamId);
      alert('Solicitud enviada al capitán');
    } catch (err) {
      alert(err.message || 'No se pudo enviar la solicitud');
    }
  };

  if (loading) return <div className="loading-spinner"><div className="spinner"></div></div>;

  return (
    <div className="page-content" style={{ paddingBottom: '80px' }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="page-title">Clubes</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {user && (
            <button className="btn btn-sm btn-primary" onClick={() => setShowCreate(!showCreate)}>
              + Crear Club
            </button>
          )}
          {user && (
            <button className="btn btn-sm btn-secondary" onClick={() => setShowCreateTeam(!showCreateTeam)}>
              + Crear Equipo
            </button>
          )}
        </div>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="card" style={{ marginBottom: '1rem', background: '#f5f5f5' }}>
          <h3>Crear Nuevo Club</h3>
          <div className="form-group">
            <label>Nombre del Club</label>
            <input required className="form-input" value={newClub.name} onChange={e => setNewClub({...newClub, name: e.target.value})} />
          </div>
          <div className="form-group">
            <label>Ciudad</label>
            <input required className="form-input" value={newClub.city} onChange={e => setNewClub({...newClub, city: e.target.value})} />
          </div>
          <div className="form-group">
            <label>Descripción</label>
            <textarea className="form-input" value={newClub.description} onChange={e => setNewClub({...newClub, description: e.target.value})} />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Guardar Club</button>
        </form>
      )}

      {showCreateTeam && (
        <form onSubmit={handleCreateTeam} className="card" style={{ marginBottom: '1rem', background: '#f5f5f5' }}>
          <h3>Crear Equipo de Jugadores</h3>
          <div className="form-group">
            <label>Nombre del Equipo</label>
            <input required className="form-input" value={newTeam.name} onChange={e => setNewTeam({ ...newTeam, name: e.target.value })} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Ciudad</label>
              <input className="form-input" value={newTeam.city} onChange={e => setNewTeam({ ...newTeam, city: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Zona</label>
              <input className="form-input" value={newTeam.zone} onChange={e => setNewTeam({ ...newTeam, zone: e.target.value })} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Formato</label>
              <select className="form-select" value={newTeam.football_type} onChange={e => setNewTeam({ ...newTeam, football_type: e.target.value })}>
                <option value="5">Fútbol 5</option>
                <option value="7">Fútbol 7</option>
                <option value="11">Fútbol 11</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Descripción</label>
            <textarea className="form-input" value={newTeam.description} onChange={e => setNewTeam({ ...newTeam, description: e.target.value })} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <input type="checkbox" checked={newTeam.is_recruiting} onChange={e => setNewTeam({ ...newTeam, is_recruiting: e.target.checked })} />
            Equipo abierto a reclutar jugadores
          </label>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Guardar Equipo</button>
        </form>
      )}

      {teams.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <h3 style={{ marginBottom: '0.8rem' }}>Equipos buscando jugadores</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            {teams.map((t) => (
              <div key={t.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{t.name}</div>
                  <div style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                    {[t.city, t.zone, t.football_type ? `F${t.football_type}` : null].filter(Boolean).join(' · ')}
                  </div>
                  <div style={{ marginTop: '0.25rem', fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                    👥 Plantel abierto · 🏆 Amateur
                  </div>
                  {t.description && <div style={{ marginTop: '0.35rem' }}>{t.description}</div>}
                </div>
                <div style={{ display: 'grid', gap: '0.35rem' }}>
                  <button className="btn btn-primary btn-sm" onClick={() => handleRequestJoinTeam(t.id)}>Ver plantel</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => handleRequestJoinTeam(t.id)}>Buscar jugadores</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => navigate('/')}>Ver partidos</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {clubs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🛡️</div>
          <div className="empty-state-title">No hay clubes aún</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {clubs.map(c => (
             <div key={c.id} className="card match-card animate-in" style={{ cursor: 'pointer' }}>
               <div className="match-card-header">
                 <div className="match-type">
                   <span className="match-type-icon">🛡️</span>
                   <span className="match-type-label" style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{c.name}</span>
                 </div>
               </div>
               <div className="match-info">
                 <div className="match-info-row">
                   <span className="info-icon">📍</span>
                   <span>{c.city}</span>
                 </div>
                 <div className="match-info-row">
                   <span className="info-icon">🏆</span>
                   <span>Liga amateur</span>
                 </div>
                 {c.description && (
                   <div className="match-info-row">
                     <span className="info-icon">💬</span>
                     <span style={{ opacity: 0.8 }}>{c.description}</span>
                   </div>
                 )}
               </div>
               <div style={{ display: 'flex', gap: '0.45rem', marginTop: '0.8rem', flexWrap: 'wrap' }}>
                 <button className="btn btn-primary btn-sm" onClick={() => navigate(`/clubs/${c.id}`)}>Ver plantel</button>
                 <button className="btn btn-secondary btn-sm" onClick={() => navigate('/clubs', { state: { openCreateTeam: true } })}>Buscar jugadores</button>
                 <button className="btn btn-secondary btn-sm" onClick={() => navigate('/')}>Ver partidos</button>
               </div>
             </div>
          ))}
        </div>
      )}
    </div>
  );
}
