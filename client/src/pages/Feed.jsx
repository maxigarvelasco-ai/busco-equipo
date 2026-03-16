import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabaseClient';
import { matchesAPI, profilesAPI } from '../services/api';
import MatchCard from '../components/MatchCard';
import { useNavigate } from 'react-router-dom';

const AREAS = ['Todas', 'Centro', 'Pichincha', 'Fisherton', 'Echesortu', 'Alberdi', 'Arroyito', 'Macrocentro'];

export default function Feed() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [matches, setMatches] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedArea, setSelectedArea] = useState('Todas');
  const [toast, setToast] = useState(null);
  const [profileQuery, setProfileQuery] = useState('');
  const [profileResults, setProfileResults] = useState([]);
  const [searchingProfiles, setSearchingProfiles] = useState(false);

  const [initialLoad, setInitialLoad] = useState(true);

  const loadMatches = useCallback(async (showSpinner = false) => {
    try {
      if (showSpinner) setIsLoading(true);
      const data = await matchesAPI.getAll({ zone: selectedArea }, user?.id);
      setMatches(data || []);
      setError(null);
    } catch (err) {
      console.error("Error loading matches:", err);
      setError("No se pudieron cargar los partidos.");
    } finally {
      setIsLoading(false);
      setInitialLoad(false);
    }
  }, [selectedArea, user]);

  useEffect(() => {
    loadMatches(true); // solo la primera vez muestra spinner
  }, [loadMatches]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleJoin = async (matchId) => {
    if (!user) { navigate('/login'); return; }
    try {
      const res = await matchesAPI.requestJoin(matchId);
      if (res?.alreadyRequested) {
        showToast('Revisá las políticas de la app para este caso', 'error');
        navigate('/support', { state: { openPolicy: 'abandon' } });
      } else if (res?.blockedByAbandon) {
        showToast('Aplican políticas por abandono cercano al horario', 'error');
        navigate('/support', { state: { openPolicy: 'abandon' } });
      } else {
        showToast('¡Solicitud enviada! 🎉');
      }
      loadMatches(false); // recarga silenciosa
    } catch (err) {
      showToast(err.message || 'Error al solicitar unirse', 'error');
    }
  };

  const handleLeave = async (matchId) => {
    try {
      await matchesAPI.leave(matchId);
      showToast('Saliste del partido');
      loadMatches(false); // recarga silenciosa
    } catch (err) {
      showToast(err.message || 'Error al salir', 'error');
    }
  };

  const handleCancel = async (matchId) => {
    try {
      await matchesAPI.cancelRequest(matchId);
      showToast('Solicitud cancelada');
      loadMatches(false);
    } catch (err) {
      console.error('Error cancelling request:', err);
      showToast(err.message || 'Error al cancelar solicitud', 'error');
    }
  };

  const handleDelete = async (matchId) => {
    if (!confirm('Seguro querés eliminar este partido?')) return;
    try {
      await matchesAPI.deleteMatch(matchId);
      showToast('Partido eliminado');
      loadMatches(false);
    } catch (err) {
      console.error('Error deleting match:', err);
      showToast(err.message || 'Error al eliminar partido', 'error');
    }
  };

  const handleSearchProfiles = async () => {
    try {
      setSearchingProfiles(true);
      const results = await profilesAPI.searchProfiles(profileQuery, user?.id);
      setProfileResults(results);
    } catch (err) {
      console.error('Error searching profiles:', err);
      showToast('No se pudieron buscar perfiles', 'error');
    } finally {
      setSearchingProfiles(false);
    }
  };

  return (
    <div className="page-content">
      {toast && (
        <div className={`toast toast-${toast.type}`}>{toast.message}</div>
      )}

      <div className="page-header">
        <h1 className="page-title">Partidos</h1>
      </div>

      <div className="area-filter">
        {AREAS.map(area => (
          <button
            key={area}
            className={`area-pill ${selectedArea === area ? 'active' : ''}`}
            onClick={() => setSelectedArea(area)}
          >
            {area}
          </button>
        ))}
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="section-header" style={{ marginBottom: '0.75rem' }}>
          <span className="section-title">Buscar perfiles</span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <input
            className="form-input"
            style={{ flex: 1 }}
            placeholder="Nombre de usuario"
            value={profileQuery}
            onChange={(e) => setProfileQuery(e.target.value)}
          />
          <button className="btn btn-secondary" onClick={handleSearchProfiles} disabled={searchingProfiles}>
            {searchingProfiles ? 'Buscando...' : 'Buscar'}
          </button>
        </div>
        {profileResults.length > 0 && (
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {profileResults.map((p) => (
              <div key={p.id} className="card" style={{ padding: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  {p.avatar_url ? (
                    <img src={p.avatar_url} alt={p.name} style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#ddd', display: 'grid', placeItems: 'center' }}>
                      {(p.name || '?').slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <strong>{p.name || 'Sin nombre'}</strong>
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => navigate(`/users/${p.id}`)}>Ver perfil</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="loading-spinner"><div className="spinner"></div></div>
      ) : error ? (
        <div className="empty-state">
          <div className="empty-state-icon">⚠️</div>
          <div className="empty-state-title">{error}</div>
        </div>
      ) : matches.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">⚽</div>
          <div className="empty-state-title">No hay partidos en esta zona</div>
          <p style={{ marginBottom: '1.5rem', color: 'var(--color-text-muted)' }}>
            Sé el primero en crear uno
          </p>
          <button className="btn btn-primary" onClick={() => navigate(user ? '/create-match' : '/login')}>
            Crear Partido
          </button>
        </div>
      ) : (
        matches.map(match => (
          <div key={match.id} style={{ cursor: 'pointer' }}>
            <MatchCard
              match={match}
              onOpen={() => navigate(`/match/${match.id}`)}
              onJoin={() => handleJoin(match.id)}
              onLeave={() => handleLeave(match.id)}
              onCancel={() => handleCancel(match.id)}
              onDelete={() => handleDelete(match.id)}
              has_requested={match.has_requested}
              userId={user?.id}
            />
          </div>
        ))
      )}
    </div>
  );
}
