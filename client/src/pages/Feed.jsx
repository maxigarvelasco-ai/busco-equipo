import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { matchesAPI } from '../services/api';
import MatchCard from '../components/MatchCard';
import { useNavigate } from 'react-router-dom';

const AREAS = ['Todas', 'Centro', 'Pichincha', 'Fisherton', 'Echesortu', 'Alberdi', 'Arroyito', 'Macrocentro'];

export default function Feed() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedArea, setSelectedArea] = useState('Todas');
  const [toast, setToast] = useState(null);

  const loadMatches = useCallback(async () => {
    // Prevent multiple simultaneous fetches
    setLoading(true);
    
    // Create an AbortController for the 5-second timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const filters = {};
      if (selectedArea !== 'Todas') filters.zone = selectedArea;
      
      // We pass the controller signal if the api supports it, 
      // but to be safe we'll use Promise.race to enforce the timeout on the client side
      const fetchPromise = matchesAPI.getAll(filters, user?.id);
      
      // Create a timeout promise that rejects after 5 seconds
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('TIMEOUT')), 5000);
      });

      // Race the fetch against the timeout
      const data = await Promise.race([fetchPromise, timeoutPromise]);
      setMatches(data || []);
    } catch (err) {
      console.error('Error fetching matches:', err);
      // Even on error, we ensure we return an empty array to stop the loading state gracefully
      setMatches([]);
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  }, [selectedArea, user?.id]);

  useEffect(() => {
    // Initial load
    loadMatches();

    // Reload on focus
    const handleFocus = () => {
      console.log("Window focused, reloading matches...");
      loadMatches();
    };

    window.addEventListener('focus', handleFocus);

    // Cleanup listener on unmount
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
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
      loadMatches();
    } catch (err) {
      showToast(err.message || 'Error al solicitar unirse', 'error');
    }
  };

  const handleLeave = async (matchId) => {
    try {
      await matchesAPI.leave(matchId);
      showToast('Saliste del partido');
      loadMatches();
    } catch (err) {
      showToast(err.message || 'Error al salir', 'error');
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

      {loading ? (
        <div className="loading-spinner"><div className="spinner"></div></div>
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
          <div key={match.id} onClick={() => navigate(`/match/${match.id}`)} style={{ cursor: 'pointer' }}>
            <MatchCard
              match={match}
              onJoin={(e) => { e.stopPropagation(); handleJoin(match.id); }}
              onLeave={(e) => { e.stopPropagation(); handleLeave(match.id); }}
              userId={user?.id}
            />
          </div>
        ))
      )}
    </div>
  );
}
