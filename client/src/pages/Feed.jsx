import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { matchesAPI, userTeamsAPI, tournamentsAPI } from '../services/api';
import MatchCard from '../components/MatchCard';
import { useNavigate } from 'react-router-dom';

const AREAS = ['Todas', 'Centro', 'Pichincha', 'Fisherton', 'Echesortu', 'Alberdi', 'Arroyito', 'Macrocentro'];
const FOOTBALL_TYPES = ['Todas', '5', '7', '11'];
const MATCH_KINDS = [
  { id: 'all', label: 'Todos' },
  { id: 'recreativo', label: '🟢 Recreativo' },
  { id: 'competitivo', label: '🟡 Competitivo' },
  { id: 'torneo', label: '🔴 Torneo' },
];

export default function Feed() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [matches, setMatches] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedArea, setSelectedArea] = useState('Todas');
  const [selectedFootballType, setSelectedFootballType] = useState('Todas');
  const [selectedMatchKind, setSelectedMatchKind] = useState('all');
  const [selectedDateFilter, setSelectedDateFilter] = useState('today');
  const [toast, setToast] = useState(null);
  const [teams, setTeams] = useState([]);
  const [tournaments, setTournaments] = useState([]);

  const loadMatches = useCallback(async (showSpinner = false) => {
    try {
      if (showSpinner) setIsLoading(true);
      const filters = {
        zone: selectedArea,
        football_type: selectedFootballType === 'Todas' ? null : selectedFootballType,
        match_kind: selectedMatchKind === 'all' ? null : selectedMatchKind,
      };
      const [data, teamsData, tournamentsData] = await Promise.all([
        matchesAPI.getAll(filters, user?.id),
        userTeamsAPI.getAll({ is_recruiting: true }).catch(() => []),
        tournamentsAPI.getAll().catch(() => []),
      ]);
      setMatches(data || []);
      setTeams(teamsData || []);
      setTournaments(tournamentsData || []);
      setError(null);
    } catch (err) {
      console.error("Error loading matches:", err);
      setError("No se pudieron cargar los partidos.");
    } finally {
      setIsLoading(false);
    }
  }, [selectedArea, selectedFootballType, selectedMatchKind, user]);

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

  const toLocalDate = (dateStr) => {
    const [y, m, d] = String(dateStr || '').split('-').map(Number);
    if (!y || !m || !d) return new Date(dateStr);
    return new Date(y, m - 1, d);
  };

  const filteredByDate = (matches || []).filter((m) => {
    if (!m.match_date) return true;
    const date = toLocalDate(m.match_date);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endWeek = new Date(today);
    endWeek.setDate(today.getDate() + 7);

    if (selectedDateFilter === 'today') {
      return date.toDateString() === today.toDateString();
    }
    if (selectedDateFilter === 'week') {
      return date >= today && date <= endWeek;
    }
    return true;
  });

  const seArma = matchesAPI.getSeArma(filteredByDate).slice(0, 3);
  const upcomingTournaments = (tournaments || []).filter((t) => {
    if (!t.start_date) return false;
    return toLocalDate(t.start_date) >= new Date(new Date().setHours(0, 0, 0, 0));
  }).slice(0, 4);

  return (
    <div className="page-content">
      {toast && (
        <div className={`toast toast-${toast.type}`}>{toast.message}</div>
      )}

      <div className="page-header">
        <h1 className="page-title">Partidos</h1>
      </div>

      <div className="card" style={{ marginBottom: '0.9rem', padding: '0.85rem' }}>
        <div style={{ display: 'grid', gap: '0.65rem' }}>
          <div className="area-filter" style={{ marginTop: 0 }}>
            {['today', 'week', 'all'].map((f) => (
              <button
                key={f}
                className={`area-pill ${selectedDateFilter === f ? 'active' : ''}`}
                onClick={() => setSelectedDateFilter(f)}
              >
                {f === 'today' ? '📅 Hoy' : f === 'week' ? '🗓 Esta semana' : 'Todos'}
              </button>
            ))}
          </div>
          <div className="area-filter" style={{ marginTop: 0 }}>
            {MATCH_KINDS.map((kind) => (
              <button
                key={kind.id}
                className={`area-pill ${selectedMatchKind === kind.id ? 'active' : ''}`}
                onClick={() => setSelectedMatchKind(kind.id)}
              >
                {kind.label}
              </button>
            ))}
          </div>
        </div>
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

      <div className="area-filter" style={{ marginTop: '0.5rem' }}>
        {FOOTBALL_TYPES.map(type => (
          <button
            key={type}
            className={`area-pill ${selectedFootballType === type ? 'active' : ''}`}
            onClick={() => setSelectedFootballType(type)}
          >
            {type === 'Todas' ? 'Todo fútbol' : `F${type}`}
          </button>
        ))}
      </div>

      {seArma.length > 0 && (
        <div className="card" style={{ marginBottom: '1rem', padding: '0.9rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
            <strong>⚡ Se arma</strong>
            <span style={{ color: 'var(--color-text-muted)', fontSize: '0.78rem' }}>Urgente</span>
          </div>
          <div style={{ display: 'grid', gap: '0.6rem' }}>
            {seArma.map((m) => (
              <button
                key={m.id}
                className="btn btn-secondary"
                style={{ justifyContent: 'space-between', width: '100%' }}
                onClick={() => navigate(`/match/${m.id}`)}
              >
                <span>{`⚽ F${m.football_type} · ${m.zone || 'Sin zona'}`}</span>
                <span>{`${m.players_joined ?? m.current_players ?? 0}/${m.max_players}`}</span>
              </button>
            ))}
          </div>
        </div>
      )}

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
      ) : filteredByDate.length === 0 ? (
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
        filteredByDate.map(match => (
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

      {teams.length > 0 && (
        <div className="card" style={{ marginTop: '1rem', padding: '0.9rem' }}>
          <strong style={{ display: 'block', marginBottom: '0.7rem' }}>🛡 Equipos buscando jugadores</strong>
          <div style={{ display: 'grid', gap: '0.6rem' }}>
            {teams.slice(0, 3).map((t) => (
              <div key={t.id} className="card" style={{ padding: '0.7rem' }}>
                <div style={{ fontWeight: 700 }}>{t.name}</div>
                <div style={{ color: 'var(--color-text-muted)', fontSize: '0.82rem' }}>
                  {[t.city, t.zone, t.football_type ? `F${t.football_type}` : null].filter(Boolean).join(' · ')}
                </div>
                <button className="btn btn-primary btn-sm" style={{ marginTop: '0.5rem' }} onClick={() => navigate('/clubs')}>
                  Ver equipos
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {upcomingTournaments.length > 0 && (
        <div className="card" style={{ marginTop: '1rem', padding: '0.9rem' }}>
          <strong style={{ display: 'block', marginBottom: '0.7rem' }}>🏆 Torneos abiertos</strong>
          <div style={{ display: 'grid', gap: '0.6rem' }}>
            {upcomingTournaments.map((t) => (
              <div key={t.id} className="card" style={{ padding: '0.7rem' }}>
                <div style={{ fontWeight: 700 }}>{t.name}</div>
                <div style={{ color: 'var(--color-text-muted)', fontSize: '0.82rem' }}>
                  {[t.city, t.zone, t.start_date ? new Date(t.start_date).toLocaleDateString('es-AR') : null].filter(Boolean).join(' · ')}
                </div>
                <button className="btn btn-secondary btn-sm" style={{ marginTop: '0.5rem' }} onClick={() => navigate('/tournaments')}>
                  Ver torneos
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
