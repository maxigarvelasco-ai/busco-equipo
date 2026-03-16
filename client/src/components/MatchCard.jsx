export default function MatchCard({ match, onJoin, onLeave, onCancel, has_requested, userId, onOpen, onDelete }) {
  const playersJoined = match.players_joined ?? match.current_players ?? 0;
  const maxPlayers = match.max_players;
  const isFull = playersJoined >= maxPlayers;
  // Determine creator robustly: coerce to string to avoid number/string mismatch
  const uid = userId != null ? String(userId) : null;
  const matchCreatorId = match.creator_id ?? match.organizer_id ?? (match.creator && match.creator.id) ?? null;
  const isCreator = Boolean(uid && matchCreatorId && uid === String(matchCreatorId));

  const matchDate = new Date(match.match_date);
  const today = new Date();
  const isToday = matchDate.toDateString() === today.toDateString();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = matchDate.toDateString() === tomorrow.toDateString();

  const dateLabel = isToday ? 'Hoy' : isTomorrow ? 'Mañana' :
    matchDate.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });

  const timeStr = match.match_time ? match.match_time.slice(0, 5) : '';

  const playerDots = [];
  const dotsToShow = Math.min(maxPlayers, 10);
  for (let i = 0; i < dotsToShow; i++) {
    playerDots.push(
      <span key={i} className={`player-dot ${i < playersJoined ? 'filled' : ''}`} />
    );
  }

  return (
    <div className={`card match-card animate-in ${match.is_featured ? 'card-featured' : ''}`} onClick={() => onOpen?.(match.id)}>
      {match.is_featured && (
        <div className="badge badge-featured" style={{ marginBottom: '0.75rem' }}>
          ⭐ PARTIDO DESTACADO
        </div>
      )}

      <div className="match-card-header">
        <div className="match-type">
          <span className="match-type-icon">⚽</span>
          <span className="match-type-label">Fútbol {match.football_type}</span>
        </div>
        <span className="badge badge-type">F{match.football_type}</span>
      </div>

      <div className="match-info">
        <div className="match-info-row">
          <span className="info-icon">📍</span>
          <span><strong>{match.address ? `${match.address}` : match.zone}</strong></span>
        </div>
        <div className="match-info-row">
          <span className="info-icon">📅</span>
          <span>{dateLabel} {timeStr}</span>
        </div>
        <div className="match-info-row">
          <span className="info-icon">👤</span>
          <span>Organiza: <strong>{match.creator_name || 'Anónimo'}</strong></span>
        </div>
        {match.description && (
          <div className="match-info-row" style={{ opacity: 0.7 }}>
            <span className="info-icon">💬</span>
            <span>{match.description}</span>
          </div>
        )}
      </div>

      <div className="match-card-footer">
        <div className="match-players">
          <div className="player-dots">{playerDots}</div>
          <span className="player-count">
            <strong>{playersJoined}</strong>/{maxPlayers}
          </span>
        </div>

        {isFull ? (
          <span className="badge badge-full">COMPLETO</span>
        ) : isCreator ? (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span className="badge badge-type">TU PARTIDO</span>
            {onDelete && (
              <button className="btn btn-sm btn-danger" onClick={(e) => { e.stopPropagation(); onDelete(match.id); }} title="Eliminar partido">🗑️</button>
            )}
          </div>
        ) : match.has_joined ? (
          <button className="btn btn-sm btn-secondary" onClick={(e) => { e.stopPropagation(); onLeave?.(match.id); }}>
            Salir
          </button>
        ) : has_requested ? (
          <button className="btn btn-sm btn-warning" onClick={(e) => { e.stopPropagation(); onCancel?.(match.id); }}>
            Cancelar solicitud
          </button>
        ) : (
          <button className="btn btn-sm btn-primary" onClick={(e) => { e.stopPropagation(); onJoin?.(match.id); }}>
            Unirme
          </button>
        )}

        {/* Debug: show creator/user IDs when ?debug=1 is in URL */}
        {typeof window !== 'undefined' && window.location.search.includes('debug=1') && (
          <div style={{ marginTop: '6px', fontSize: '0.75rem', color: '#b71c1c' }}>
            DEV: creatorId={String(match.creator_id ?? match.organizer_id ?? (match.creator && match.creator.id) ?? 'null')} • userId={String(userId ?? 'null')} • creator_name={match.creator_name ?? match.creator?.name ?? 'null'}
          </div>
        )}
      </div>
    </div>
  );
}
