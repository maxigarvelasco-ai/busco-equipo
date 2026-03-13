import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { clubsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function ClubDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [club, setClub] = useState(null);
  const [members, setMembers] = useState([]);
  const [recruitments, setRecruitments] = useState([]);
  const [activeTab, setActiveTab] = useState('info');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadClubData();
  }, [id]);

  const loadClubData = async () => {
    try {
      setLoading(true);
      const c = await clubsAPI.getById(id);
      setClub(c);
      const mems = await clubsAPI.getMembers(id);
      setMembers(mems);
      const recs = await clubsAPI.getRecruitments(id);
      setRecruitments(recs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinClub = async () => {
    try {
      await clubsAPI.joinClub(id);
      alert('Te uniste al club!');
      loadClubData();
    } catch (err) {
      alert(err.message || 'Error al unirse');
    }
  };

  const isMember = members.some(m => m.user_id === user?.id);

  if (loading) return <div className="loading-spinner"><div className="spinner"></div></div>;
  if (!club) return <div className="page-content">Club no encontrado</div>;

  return (
    <div className="page-content" style={{ paddingBottom: '80px' }}>
      <div className="page-header" style={{ marginBottom: '1rem' }}>
        <button className="btn btn-sm btn-secondary" onClick={() => navigate(-1)}>Volver</button>
        <h1 className="page-title" style={{ marginTop: '0.5rem' }}>{club.name}</h1>
      </div>

      <div className="card match-card">
        <div className="match-info">
          <div className="match-info-row">
            <span className="info-icon">📍</span>
            <span>{club.city}</span>
          </div>
          <div className="match-info-row">
            <span className="info-icon">👤</span>
            <span>Creador: {club.profiles?.name}</span>
          </div>
          <p style={{ marginTop: '0.5rem', opacity: 0.8 }}>{club.description}</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid #ddd', paddingBottom: '0.5rem' }}>
        <button 
          onClick={() => setActiveTab('info')} 
          style={{ padding: '0.5rem', border: 'none', background: 'none', borderBottom: activeTab === 'info' ? '2px solid var(--color-primary)' : 'none', fontWeight: activeTab === 'info' ? 'bold' : 'normal', cursor: 'pointer' }}>
          Miembros ({members.length})
        </button>
        <button 
          onClick={() => setActiveTab('recruitments')} 
          style={{ padding: '0.5rem', border: 'none', background: 'none', borderBottom: activeTab === 'recruitments' ? '2px solid var(--color-primary)' : 'none', fontWeight: activeTab === 'recruitments' ? 'bold' : 'normal', cursor: 'pointer' }}>
          Búsquedas ({recruitments.length})
        </button>
      </div>

      {activeTab === 'info' && (
        <div>
          {!isMember && user && (
            <button className="btn btn-primary" style={{ width: '100%', marginBottom: '1rem' }} onClick={handleJoinClub}>
              Unirme al Club
            </button>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {members.map(m => (
              <div key={m.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ background: '#eee', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
                   👤
                </div>
                <div>
                  <strong>{m.profiles?.name || 'Usuario'}</strong>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-primary)' }}>{m.role === 'admin' ? 'Administrador' : 'Miembro'}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'recruitments' && (
        <div>
           {recruitments.length === 0 ? (
             <p>No hay búsquedas activas de jugadores.</p>
           ) : (
             recruitments.map(r => (
                <div key={r.id} className="card match-card" style={{ marginBottom: '1rem' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '0.5rem', color: 'var(--color-primary)' }}>
                    Buscando: {r.position_needed}
                  </div>
                  <p>{r.message}</p>
                  <p style={{ fontSize: '0.8rem', color: '#888', textAlign: 'right', margin: 0 }}>
                    {new Date(r.created_at).toLocaleDateString()}
                  </p>
                </div>
             ))
           )}
        </div>
      )}
    </div>
  );
}
