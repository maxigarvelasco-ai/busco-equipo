import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabaseClient';
import { matchesAPI } from '../services/api';
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
      await matchesAPI.requestJoin(matchId);
      showToast('¡Solicitud enviada! 🎉');
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
