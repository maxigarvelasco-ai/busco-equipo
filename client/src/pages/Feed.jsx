import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { matchesAPI, tournamentsAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';

const FOOTBALL_TYPES = ['Todas', '5', '7', '11'];
const REQUEST_TYPES = ['Todas', 'Match', 'Tournament'];

export default function Feed() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [matches, setMatches] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedFootballType, setSelectedFootballType] = useState('Todas');
  const [selectedRequestType, setSelectedRequestType] = useState('Todas');
  const [toast, setToast] = useState(null);

  const loadMatches = useCallback(async (showSpinner = false) => {
    try {
      if (showSpinner) setIsLoading(true);
      const footballType = selectedFootballType === 'Todas' ? null : selectedFootballType;
      const matchData = await matchesAPI.getAll({ football_type: footballType }, user?.id);
      setMatches(matchData || []);

      try {
        const tournamentData = await tournamentsAPI.getAll({ football_type: footballType });
        setTournaments(tournamentData || []);
      } catch (tErr) {
        console.warn('Tournaments load warning:', tErr);
        setTournaments([]);
      }
      setError(null);
    } catch (err) {
      console.error("Error loading matches:", err);
      setError("No se pudieron cargar los partidos.");
    } finally {
      setIsLoading(false);
    }
  }, [selectedFootballType, user]);

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

  const handleApplyTournament = async (tournamentId) => {
    if (!user) { navigate('/login'); return; }
    try {
      await tournamentsAPI.applyRequest(tournamentId);
      showToast('Postulacion enviada');
    } catch (err) {
      showToast(err.message || 'Error al postularse', 'error');
    }
  };

  const toLocalDate = (dateStr) => {
    const [y, m, d] = String(dateStr || '').split('-').map(Number);
    if (!y || !m || !d) return new Date(dateStr);
    return new Date(y, m - 1, d);
  };

  const normalizeRequests = () => {
    const matchRows = (matches || []).map((m) => ({
      kind: 'Match',
      id: m.id,
      football_type: m.football_type,
      city: m.city || '',
      zone: m.zone || '',
      date: m.match_date,
      time: m.match_time,
      needed_players: Math.max((m.max_players || 0) - (m.players_joined ?? m.current_players ?? 0), 0),
      joined: m.players_joined ?? m.current_players ?? 0,
      total: m.max_players,
      organizer_name: m.creator_name || 'Anónimo',
      raw: m,
    }));

    const tournamentRows = (tournaments || []).map((t) => ({
      kind: 'Tournament',
      id: t.id,
      football_type: t.football_type,
      city: t.city || t.zone || '',
      zone: t.venue_name || '',
      date: t.start_date,
      time: null,
      needed_players: t.needed_players ?? 1,
      joined: null,
      total: null,
      organizer_name: t.organizer_name || 'Anónimo',
      raw: t,
    }));

    let merged = [...matchRows, ...tournamentRows];
    if (selectedRequestType !== 'Todas') {
      merged = merged.filter((row) => row.kind === selectedRequestType);
    }

    return merged.sort((a, b) => {
      const da = toLocalDate(a.date).getTime();
      const db = toLocalDate(b.date).getTime();
      return da - db;
    });
  };

  const requests = normalizeRequests();

  return (
    <div className="page-content">
      {toast && (
        <div className={`toast toast-${toast.type}`}>{toast.message}</div>
      )}

      <div className="page-header">
        <h1 className="page-title">Solicitudes de futbol</h1>
      </div>

      <div className="area-filter">
        {FOOTBALL_TYPES.map(type => (
          <button
            key={type}
            className={`area-pill ${selectedFootballType === type ? 'active' : ''}`}
            onClick={() => setSelectedFootballType(type)}
          >
            {type === 'Todas' ? 'Todo futbol' : `F${type}`}
          </button>
        ))}
      </div>

      <div className="area-filter">
        {REQUEST_TYPES.map(type => (
          <button
            key={type}
            className={`area-pill ${selectedRequestType === type ? 'active' : ''}`}
            onClick={() => setSelectedRequestType(type)}
          >
            {type}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div style={{ display: 'grid', gap: '0.8rem' }}>
          <div className="skeleton-card"></div>
          <div className="skeleton-card"></div>
          <div className="skeleton-card"></div>
        </div>
      ) : error ? (
        <div className="empty-state">
          <div className="empty-state-icon">⚠️</div>
          <div className="empty-state-title">{error}</div>
        </div>
      ) : requests.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">⚽</div>
          <div className="empty-state-title">No hay solicitudes disponibles</div>
          <p style={{ marginBottom: '1.5rem', color: 'var(--color-text-muted)' }}>
            Crea una solicitud para buscar jugadores
          </p>
          <button className="btn btn-primary" onClick={() => navigate(user ? '/create-match' : '/login')}>
            Buscar jugadores
          </button>
        </div>
      ) : (
        requests.map((req) => (
          <div key={`${req.kind}-${req.id}`} className="card match-card" style={{ cursor: req.kind === 'Match' ? 'pointer' : 'default' }} onClick={() => req.kind === 'Match' ? navigate(`/match/${req.id}`) : null}>
            <div className="match-card-header">
              <div className="match-type">
                <span className="match-type-icon">{req.kind === 'Match' ? '⚽' : '🏆'}</span>
                <span className="match-type-label">{req.kind === 'Match' ? `Partido F${req.football_type}` : `Torneo F${req.football_type}`}</span>
              </div>
              <span className="badge badge-type">{req.kind}</span>
            </div>

            <div className="match-info">
              <div className="match-info-row"><span className="info-icon">📍</span><span>{[req.zone, req.city].filter(Boolean).join(' - ') || 'Sin ubicacion'}</span></div>
              <div className="match-info-row"><span className="info-icon">🕒</span><span>{req.time ? `${toLocalDate(req.date).toLocaleDateString('es-AR')} ${req.time?.slice(0, 5)}` : `Empieza ${toLocalDate(req.date).toLocaleDateString('es-AR')}`}</span></div>
              {req.kind === 'Match' ? (
                <div className="match-info-row"><span className="info-icon">👥</span><span>{req.joined}/{req.total} jugadores</span></div>
              ) : (
                <div className="match-info-row"><span className="info-icon">👥</span><span>Buscan {req.needed_players} jugadores</span></div>
              )}
              {req.kind === 'Match' && (
                <div className="match-info-row"><span className="info-icon">➕</span><span>Faltan {req.needed_players} jugadores</span></div>
              )}
              <div className="match-info-row"><span className="info-icon">👤</span><span>Organiza: {req.organizer_name}</span></div>
            </div>

            <div className="match-card-footer">
              {req.kind === 'Match' ? (
                <button className="btn btn-primary btn-sm" onClick={(e) => { e.stopPropagation(); handleJoin(req.id); }}>
                  Unirme
                </button>
              ) : (
                <button className="btn btn-primary btn-sm" onClick={(e) => { e.stopPropagation(); handleApplyTournament(req.id); }}>
                  Postularse
                </button>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
