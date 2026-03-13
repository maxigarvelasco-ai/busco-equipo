import { useState, useEffect } from 'react';
import { clubsAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Clubs() {
  const [clubs, setClubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    loadClubs();
  }, []);

  const loadClubs = async () => {
    try {
      setLoading(true);
      const data = await clubsAPI.getAll();
      setClubs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const [showCreate, setShowCreate] = useState(false);
  const [newClub, setNewClub] = useState({ name: '', city: '', description: '' });

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

  if (loading) return <div className="loading-spinner"><div className="spinner"></div></div>;

  return (
    <div className="page-content" style={{ paddingBottom: '80px' }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="page-title">Clubes</h1>
        {user && (
          <button className="btn btn-sm btn-primary" onClick={() => setShowCreate(!showCreate)}>
            + Crear Club
          </button>
        )}
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

      {clubs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🛡️</div>
          <div className="empty-state-title">No hay clubes aún</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {clubs.map(c => (
             <div key={c.id} className="card match-card animate-in" onClick={() => navigate(`/clubs/${c.id}`)} style={{ cursor: 'pointer' }}>
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
                 {c.description && (
                   <div className="match-info-row">
                     <span className="info-icon">💬</span>
                     <span style={{ opacity: 0.8 }}>{c.description}</span>
                   </div>
                 )}
               </div>
             </div>
          ))}
        </div>
      )}
    </div>
  );
}
