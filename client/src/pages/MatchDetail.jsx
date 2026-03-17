import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { matchesAPI } from '../services/api';
import { supabase } from '../services/supabaseClient';

function countryAbbrFromText(raw) {
  const text = String(raw || '').trim();
  if (!text) return '';
  if (/^[A-Z]{2}$/.test(text)) return text;

  const map = {
    argentina: 'AR',
    uruguay: 'UY',
    paraguay: 'PY',
    chile: 'CL',
    bolivia: 'BO',
    brasil: 'BR',
    brazil: 'BR',
    peru: 'PE',
    ecuador: 'EC',
    colombia: 'CO',
    venezuela: 'VE',
    mexico: 'MX',
    'estados unidos': 'US',
    'united states': 'US',
    espana: 'ES',
    spain: 'ES',
  };
  const key = text.toLowerCase();
  if (map[key]) return map[key];
  return text.slice(0, 2).toUpperCase();
}

function formatLocation(address, city, zone) {
  const addressText = String(address || '').trim();
  const cityText = String(city || '').trim();
  const zoneText = String(zone || '').trim();

  const parts = addressText ? addressText.split(',').map((p) => p.trim()).filter(Boolean) : [];
  const street = parts[0] || zoneText || cityText || 'Sin ubicacion';
  const countryRaw = parts.length > 1 ? parts[parts.length - 1] : '';
  const country = countryAbbrFromText(countryRaw);
  const resolvedCity = cityText && cityText !== 'Sin ciudad'
    ? cityText
    : (parts.length > 1 ? parts.find((p) => p !== street && p !== countryRaw) || '' : '');

  const compact = [street];
  if (resolvedCity && resolvedCity.toLowerCase() !== street.toLowerCase()) compact.push(resolvedCity);
  if (country && country.toLowerCase() !== resolvedCity.toLowerCase()) compact.push(country);
  return compact.filter(Boolean).join(', ');
}

export default function MatchDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { state } = useLocation();

  const [match, setMatch] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [joinRequests, setJoinRequests] = useState([]);
  const [players, setPlayers] = useState([]);
  const [hasRequested, setHasRequested] = useState(false);
  const [activeTab, setActiveTab] = useState(state?.openTab || 'info'); // info, chat, requests
  const [loading, setLoading] = useState(true);

  const appendMessageUnique = (msg) => {
    if (!msg?.id) return;
    setMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) return prev;
      return [...prev, msg];
    });
  };

  useEffect(() => {
    loadMatchData();
    
    // Subscribe to chat messages
    const chatSub = supabase.channel(`match_chat_${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'match_messages', filter: `match_id=eq.${id}` }, (payload) => {
        try {
          const n = payload?.new || payload?.record || null;
          if (!n) return;
          appendMessageUnique(n);
        } catch (e) { console.error('Realtime message handler error', e); }
      })
      .subscribe();

    return () => { supabase.removeChannel(chatSub); };
  }, [id]);

  const loadMatchData = async () => {
    try {
      setLoading(true);
      // Fetch match feed data
      const data = await matchesAPI.getAll({ zone: 'Todas' }, user?.id);
      const currentMatch = data.find(m => m.id === id);
      setMatch(currentMatch);

      if (currentMatch) {
        await loadMessages();
        await loadPlayers();
        await checkIfRequested();
        if (currentMatch.creator_id === user?.id) {
          await loadJoinRequests();
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async () => {
    try {
      const msgs = await matchesAPI.getMessages(id);
      setMessages(msgs);
    } catch (err) {
      console.error(err);
    }
  };

  const loadPlayers = async () => {
    try {
      const p = await matchesAPI.getPlayers(id);
      setPlayers(p);
    } catch (err) {
      console.error(err);
    }
  };

  const checkIfRequested = async () => {
    if (!user) return;
    try {
      const reqs = await matchesAPI.getJoinRequests(id);
      setHasRequested(reqs.some(r => r.user_id === user.id));
    } catch(err) {
      console.error(err);
    }
  }

  const loadJoinRequests = async () => {
    try {
      const reqs = await matchesAPI.getJoinRequests(id);
      setJoinRequests(reqs);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;
    try {
      const inserted = await matchesAPI.sendMessage(id, newMessage);
      appendMessageUnique(inserted);
      setNewMessage('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleApprove = async (reqId, userId) => {
    try {
      await matchesAPI.approveRequest(reqId, id, userId);
      loadJoinRequests();
      loadPlayers(); // reload players
      loadMatchData(); // to update player count
    } catch (err) {
      console.error(err);
    }
  };

  const handleReject = async (reqId, userId) => {
    try {
      await matchesAPI.rejectRequest(reqId, id, userId);
      loadJoinRequests();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Seguro querés eliminar este partido? Esta acción no se puede deshacer.')) return;
    try {
      await matchesAPI.deleteMatch(id);
      alert('Partido eliminado');
      navigate('/');
    } catch (err) {
      console.error(err);
      alert(err.message || 'Error eliminando el partido');
    }
  };

  if (loading) return <div className="loading-spinner"><div className="spinner"></div></div>;
  if (!match) return <div className="page-content">Partido no encontrado</div>;

  const toLocalDate = (dateStr) => {
    if (!dateStr) return new Date();
    const [y, m, d] = String(dateStr).split('-').map(Number);
    if (!y || !m || !d) return new Date(dateStr);
    return new Date(y, m - 1, d);
  };

  const ownerId = match.owner_id ?? match.creator_id ?? null;
  const isCreator = Boolean(user && ownerId && String(user.id) === String(ownerId));
  const locationLabel = formatLocation(match.address, match.city, match.zone);
  const joinedTotal = Math.max(Number(players.length || 0), 0);
  const neededPlayers = Math.max(Number(match.max_players || 1) - 1, 1);
  const joinedNeededPlayers = Math.max(joinedTotal - 1, 0);
  const missingNeededPlayers = Math.max(neededPlayers - joinedNeededPlayers, 0);

  return (
    <div className="page-content" style={{ paddingBottom: '80px' }}>
      <div className="page-header match-detail-header">
        <button className="btn btn-sm btn-secondary" onClick={() => navigate(-1)}>Volver</button>
        <h1 className="page-title">Detalle del Partido</h1>
        {isCreator && <button className="btn btn-sm btn-danger" onClick={handleDelete}>Eliminar partido</button>}
      </div>

      <div className="card match-card" style={{ marginBottom: '1rem' }}>
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
            <span><strong>{locationLabel}</strong></span>
          </div>
          <div className="match-info-row">
            <span className="info-icon">📅</span>
            <span>{toLocalDate(match.match_date).toLocaleDateString('es-AR')} {match.match_time?.slice(0,5)}</span>
          </div>
          <div className="match-info-row">
            <span className="info-icon">👤</span>
            <span>Organiza: <strong>{match.creator_name}</strong></span>
          </div>
          <div className="match-info-row">
            <span className="info-icon">👥</span>
            <span><strong>Faltan {missingNeededPlayers} jugadores de {neededPlayers}</strong></span>
          </div>
          {match.description && (
             <div className="match-info-row" style={{ opacity: 0.7 }}>
               <span className="info-icon">💬</span>
               <span>{match.description}</span>
             </div>
          )}
        </div>
      </div>

      <div className="match-detail-tabs">
        <button 
          onClick={() => setActiveTab('info')} 
          className={`match-detail-tab ${activeTab === 'info' ? 'active' : ''}`}>
          Información
        </button>
        <button 
          onClick={() => setActiveTab('chat')} 
          className={`match-detail-tab ${activeTab === 'chat' ? 'active' : ''}`}>
          Chat
        </button>
        {isCreator && (
          <button 
            onClick={() => setActiveTab('requests')} 
            className={`match-detail-tab ${activeTab === 'requests' ? 'active' : ''}`}>
            Solicitudes
            {joinRequests.length > 0 && <span className="match-detail-tab-badge">{joinRequests.length}</span>}
          </button>
        )}
      </div>

      {activeTab === 'info' && (
        <div>
          <h3>Jugadores · Faltan {missingNeededPlayers} jugadores de {neededPlayers}</h3>
          {players.length > 0 ? (
            <ul className="match-players-list">
              {players.map(p => (
                <li key={p.user_id} className="card match-player-item">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                    <strong>{p.profiles?.name || 'Jugador'}</strong>
                    {isCreator && (
                      <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/users/${p.user_id}`)}>
                        Ver perfil
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ color: 'var(--color-text-muted)' }}>Aún no hay jugadores confirmados.</p>
          )}
          
          {!isCreator && (
            <button 
              className="btn btn-primary" 
              style={{ marginTop: '1rem', width: '100%' }} 
              onClick={async () => {
                try {
                  const res = await matchesAPI.requestJoin(match.id);
                  if (res && res.alreadyRequested) {
                    setHasRequested(true);
                    navigate('/support', { state: { openPolicy: 'abandon' } });
                  } else if (res && res.blockedByAbandon) {
                    navigate('/support', { state: { openPolicy: 'abandon' } });
                  } else {
                    setHasRequested(true);
                    alert('Solicitud enviada');
                  }
                } catch (err) {
                  alert('Error al enviar solicitud: ' + (err?.message || 'ver consola'));
                }
              }}
              disabled={match.has_joined || hasRequested}
            >
              {match.has_joined ? 'Ya estás unido' : (hasRequested ? 'Solicitud pendiente' : 'Solicitar Unirse')}
            </button>
          )}
        </div>
      )}

      {activeTab === 'chat' && (
        <div className="match-chat-panel">
          <div className="match-chat-messages">
            {messages.length === 0 ? (
              <p className="match-chat-empty">No hay mensajes aun.</p>
            ) : (
              messages.map(msg => (
                <div key={msg.id} className={`match-chat-message ${msg.user_id === user?.id ? 'mine' : ''}`}>
                  <span className="match-chat-author">{msg.profiles?.name || 'Usuario'}</span>
                  <div className={`match-chat-bubble ${msg.user_id === user?.id ? 'mine' : ''}`}>
                    {msg.message}
                  </div>
                </div>
              ))
            )}
          </div>
          <form onSubmit={handleSendMessage} className="match-chat-form">
            <input 
              type="text" 
              value={newMessage} 
              onChange={e => setNewMessage(e.target.value)}
              placeholder="Escribe un mensaje..." 
              className="form-input" 
            />
            <button type="submit" className="btn btn-primary">Enviar</button>
          </form>
        </div>
      )}

      {activeTab === 'requests' && isCreator && (
        <div>
          {joinRequests.length === 0 ? (
            <p>No hay solicitudes pendientes.</p>
          ) : (
            joinRequests.map(req => (
              <div key={req.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <div>
                  <strong>{req.profiles?.name || 'Usuario'}</strong>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button 
                    className="btn btn-sm btn-primary" 
                    onClick={() => handleApprove(req.id, req.user_id)}
                    disabled={players.length >= match.max_players}
                    title={players.length >= match.max_players ? 'El partido ya está lleno' : 'Aceptar jugador'}
                  >
                    Aceptar
                  </button>
                  <button className="btn btn-sm btn-secondary" onClick={() => handleReject(req.id, req.user_id)}>Rechazar</button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
