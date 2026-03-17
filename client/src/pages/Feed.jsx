import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { matchesAPI, tournamentsAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';

const FOOTBALL_TYPES = ['Todas', '5', '7', '11'];
const REQUEST_TYPES = ['Todas', 'Match', 'Tournament'];
const GENDER_FILTERS = ['Todos', 'Masculino', 'Femenino', 'Mixto'];

function toLocalDate(dateStr) {
  const [y, m, d] = String(dateStr || '').split('-').map(Number);
  if (!y || !m || !d) return new Date(dateStr);
  return new Date(y, m - 1, d);
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const r = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatWhen(date, time) {
  const d = toLocalDate(date);
  const today = new Date();
  const baseToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const baseDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((baseDate - baseToday) / (1000 * 60 * 60 * 24));
  const hhmm = time ? String(time).slice(0, 5) : null;

  if (diffDays === 0) return hhmm ? `Hoy ${hhmm}` : 'Hoy';
  if (diffDays === 1) return hhmm ? `Mañana ${hhmm}` : 'Mañana';
  return hhmm ? `${baseDate.toLocaleDateString('es-AR')} ${hhmm}` : baseDate.toLocaleDateString('es-AR');
}

function matchesProfileRestrictions(item, profile) {
  if (!item) return true;
  const requiredGender = item.match_gender || 'mixto';
  const requiredAge = !!item.age_restricted;
  const minAge = item.min_age ?? null;
  const maxAge = item.max_age ?? null;
  const userGender = profile?.gender || null;
  const userAge = profile?.age ?? null;

  if (requiredGender !== 'mixto') {
    if (!userGender) return false;
    if (requiredGender !== userGender) return false;
  }

  if (requiredAge) {
    if (!userAge) return false;
    if (minAge != null && userAge < minAge) return false;
    if (maxAge != null && userAge > maxAge) return false;
  }

  return true;
}

export default function Feed() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [matches, setMatches] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedFootballType, setSelectedFootballType] = useState('Todas');
  const [selectedRequestType, setSelectedRequestType] = useState('Todas');
  const [selectedGender, setSelectedGender] = useState('Todos');
  const [toast, setToast] = useState(null);
  const [coords, setCoords] = useState(null);

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
      console.error('Error loading matches:', err);
      setError('No se pudieron cargar los partidos.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedFootballType, user]);

  useEffect(() => {
    loadMatches(true);
  }, [loadMatches]);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      ({ coords: c }) => setCoords({ lat: c.latitude, lng: c.longitude }),
      () => setCoords(null),
      { enableHighAccuracy: false, timeout: 7000, maximumAge: 300000 }
    );
  }, []);

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
      loadMatches(false);
    } catch (err) {
      showToast(err.message || 'Error al solicitar unirse', 'error');
    }
  };

  const handleLeave = async (matchId) => {
    try {
      await matchesAPI.leave(matchId);
      showToast('Saliste del partido');
      loadMatches(false);
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
      showToast(err.message || 'Error al cancelar solicitud', 'error');
    }
  };

  const handleDelete = async (matchId) => {
    if (!confirm('Seguro queres eliminar este partido?')) return;
    try {
      await matchesAPI.deleteMatch(matchId);
      showToast('Partido eliminado');
      loadMatches(false);
    } catch (err) {
      showToast(err.message || 'Error al eliminar partido', 'error');
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

  const normalizeRequests = () => {
    const matchRows = (matches || []).map((m) => {
      const lat = m.latitude != null ? Number(m.latitude) : null;
      const lng = m.longitude != null ? Number(m.longitude) : null;
      const distanceKm = coords && Number.isFinite(lat) && Number.isFinite(lng)
        ? haversineKm(coords.lat, coords.lng, lat, lng)
        : null;

      return {
        kind: 'Match',
        id: m.id,
        football_type: m.football_type,
        address: m.address || m.zone || '',
        city: m.city || '',
        date: m.match_date,
        time: m.match_time,
        joined: m.players_joined ?? m.current_players ?? 0,
        total: m.max_players,
        organizer_name: m.creator_name || 'Anónimo',
        raw: m,
        distanceKm,
        match_gender: m.match_gender || 'mixto',
        age_restricted: !!m.age_restricted,
        min_age: m.min_age ?? null,
        max_age: m.max_age ?? null,
        goalkeepers_needed: m.goalkeepers_needed || 1,
      };
    });

    const tournamentRows = (tournaments || []).map((t) => ({
      kind: 'Tournament',
      id: t.id,
      football_type: t.football_type,
      address: t.venue_name || '',
      city: t.city || t.zone || '',
      date: t.start_date,
      time: null,
      joined: null,
      total: null,
      organizer_name: t.organizer_name || 'Anónimo',
      raw: t,
      distanceKm: null,
      match_gender: t.match_gender || 'mixto',
      age_restricted: !!t.age_restricted,
      min_age: t.min_age ?? null,
      max_age: t.max_age ?? null,
      goalkeepers_needed: null,
      needed_players: t.needed_players ?? 1,
    }));

    let merged = [...matchRows, ...tournamentRows];

    merged = merged.filter((row) => matchesProfileRestrictions(row, profile));

    if (selectedRequestType !== 'Todas') {
      merged = merged.filter((row) => row.kind === selectedRequestType);
    }

    if (selectedGender !== 'Todos') {
      const normalizedGender = selectedGender.toLowerCase();
      merged = merged.filter((row) => (row.match_gender || 'mixto') === normalizedGender);
    }

    return merged.sort((a, b) => {
      const ad = a.kind === 'Match' ? (a.distanceKm ?? Number.POSITIVE_INFINITY) : Number.POSITIVE_INFINITY;
      const bd = b.kind === 'Match' ? (b.distanceKm ?? Number.POSITIVE_INFINITY) : Number.POSITIVE_INFINITY;
      if (ad !== bd) return ad - bd;
      return toLocalDate(a.date).getTime() - toLocalDate(b.date).getTime();
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
        {FOOTBALL_TYPES.map((type) => (
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
        {REQUEST_TYPES.map((type) => (
          <button
            key={type}
            className={`area-pill ${selectedRequestType === type ? 'active' : ''}`}
            onClick={() => setSelectedRequestType(type)}
          >
            {type}
          </button>
        ))}
      </div>

      <div className="area-filter">
        {GENDER_FILTERS.map((type) => (
          <button
            key={type}
            className={`area-pill ${selectedGender === type ? 'active' : ''}`}
            onClick={() => setSelectedGender(type)}
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
          <div className="empty-state-title">No hay solicitudes compatibles para tu perfil</div>
          <p style={{ marginBottom: '1.5rem', color: 'var(--color-text-muted)' }}>
            Probá otro filtro o creá una solicitud nueva
          </p>
          <button className="btn btn-primary" onClick={() => navigate(user ? '/create-match' : '/login')}>
            Buscar jugadores
          </button>
        </div>
      ) : (
        requests.map((req) => (
          <div
            key={`${req.kind}-${req.id}`}
            className="card match-card"
            style={{ cursor: req.kind === 'Match' ? 'pointer' : 'default' }}
            onClick={() => (req.kind === 'Match' ? navigate(`/match/${req.id}`) : null)}
          >
            <div className="match-card-header">
              <div className="match-type">
                <span className="match-type-icon">{req.kind === 'Match' ? '⚽' : '🏆'}</span>
                <span className="match-type-label">{req.kind === 'Match' ? `Partido F${req.football_type}` : `Torneo F${req.football_type}`}</span>
              </div>
              <span className="badge badge-type">{req.match_gender || 'mixto'}</span>
            </div>

            <div className="match-info">
              <div className="match-info-row">
                <span className="info-icon">📍</span>
                <span>{[req.address, req.city].filter(Boolean).join(' - ') || 'Sin ubicación'}</span>
              </div>
              <div className="match-info-row">
                <span className="info-icon">🕒</span>
                <span>{formatWhen(req.date, req.time)}</span>
              </div>
              {req.kind === 'Match' ? (
                <div className="match-info-row">
                  <span className="info-icon">👥</span>
                  <span>
                    {req.joined} / {req.total} jugadores{req.goalkeepers_needed > 0 ? ` · ${req.goalkeepers_needed} arquero${req.goalkeepers_needed === 2 ? 's' : ''}` : ''}
                  </span>
                </div>
              ) : (
                <div className="match-info-row">
                  <span className="info-icon">👥</span>
                  <span>Buscan {req.needed_players} jugadores</span>
                </div>
              )}
              {req.kind === 'Match' && req.distanceKm != null && (
                <div className="match-info-row">
                  <span className="info-icon">📏</span>
                  <span>{req.distanceKm.toFixed(1)} km de vos</span>
                </div>
              )}
            </div>

            <div className="match-card-footer">
              {req.kind === 'Match' ? (
                (() => {
                  const m = req.raw || {};
                  const playersJoined = m.players_joined ?? m.current_players ?? 0;
                  const maxPlayers = m.max_players || 0;
                  const isFull = maxPlayers > 0 && playersJoined >= maxPlayers;
                  const matchCreatorId = m.owner_id ?? m.creator_id ?? null;
                  const isCreator = Boolean(user?.id && matchCreatorId && String(user.id) === String(matchCreatorId));

                  if (isCreator) {
                    return (
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <span className="badge badge-type">TU PARTIDO</span>
                        <button className="btn btn-sm btn-danger" onClick={(e) => { e.stopPropagation(); handleDelete(req.id); }}>
                          Eliminar
                        </button>
                      </div>
                    );
                  }

                  if (m.has_joined) {
                    return (
                      <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); handleLeave(req.id); }}>
                        Salir
                      </button>
                    );
                  }

                  if (m.has_requested) {
                    return (
                      <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); handleCancel(req.id); }}>
                        Cancelar solicitud
                      </button>
                    );
                  }

                  if (isFull) {
                    return <span className="badge badge-full">Completo</span>;
                  }

                  return (
                    <button className="btn btn-primary btn-sm" onClick={(e) => { e.stopPropagation(); handleJoin(req.id); }}>
                      Unirme
                    </button>
                  );
                })()
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
