import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { matchesAPI } from '../services/api';
import { supabase } from '../services/supabaseClient';

export default function MatchDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [match, setMatch] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [joinRequests, setJoinRequests] = useState([]);
  const [activeTab, setActiveTab] = useState('info'); // info, chat, requests
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMatchData();
    
    // Subscribe to chat messages
    const chatSub = supabase.channel(`match_chat_${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'match_messages', filter: `match_id=eq.${id}` }, loadMessages)
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
      await matchesAPI.sendMessage(id, newMessage);
      setNewMessage('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleApprove = async (reqId, userId) => {
    try {
      await matchesAPI.approveRequest(reqId, id, userId);
      loadJoinRequests();
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

  if (loading) return <div className="loading-spinner"><div className="spinner"></div></div>;
  if (!match) return <div className="page-content">Partido no encontrado</div>;

  const isCreator = match.creator_id === user?.id;

  return (
    <div className="page-content" style={{ paddingBottom: '80px' }}>
      <div className="page-header" style={{ marginBottom: '1rem' }}>
        <button className="btn btn-sm btn-secondary" onClick={() => navigate(-1)}>Volver</button>
        <h1 className="page-title" style={{ marginTop: '0.5rem' }}>Detalle del Partido</h1>
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
            <span><strong>{match.address ? match.address : match.zone}</strong></span>
          </div>
          <div className="match-info-row">
            <span className="info-icon">📅</span>
            <span>{new Date(match.match_date).toLocaleDateString()} {match.match_time?.slice(0,5)}</span>
          </div>
          <div className="match-info-row">
            <span className="info-icon">👤</span>
            <span>Organiza: <strong>{match.creator_name}</strong></span>
          </div>
          {match.description && (
             <div className="match-info-row" style={{ opacity: 0.7 }}>
               <span className="info-icon">💬</span>
               <span>{match.description}</span>
             </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid #ddd', paddingBottom: '0.5rem' }}>
        <button 
          onClick={() => setActiveTab('info')} 
          style={{ padding: '0.5rem', border: 'none', background: 'none', borderBottom: activeTab === 'info' ? '2px solid var(--color-primary)' : 'none', fontWeight: activeTab === 'info' ? 'bold' : 'normal', cursor: 'pointer' }}>
          Información
        </button>
        <button 
          onClick={() => setActiveTab('chat')} 
          style={{ padding: '0.5rem', border: 'none', background: 'none', borderBottom: activeTab === 'chat' ? '2px solid var(--color-primary)' : 'none', fontWeight: activeTab === 'chat' ? 'bold' : 'normal', cursor: 'pointer' }}>
          Chat
        </button>
        {isCreator && (
          <button 
            onClick={() => setActiveTab('requests')} 
            style={{ padding: '0.5rem', border: 'none', background: 'none', borderBottom: activeTab === 'requests' ? '2px solid var(--color-primary)' : 'none', fontWeight: activeTab === 'requests' ? 'bold' : 'normal', cursor: 'pointer', position: 'relative' }}>
            Solicitudes
            {joinRequests.length > 0 && <span style={{ background: 'red', color: 'white', borderRadius: '10px', padding: '2px 6px', fontSize: '0.7rem', marginLeft: '5px' }}>{joinRequests.length}</span>}
          </button>
        )}
      </div>

      {activeTab === 'info' && (
        <div>
          <h3>Jugadores ({match.players_joined || 0}/{match.max_players})</h3>
          {/* We would list players here if we fetched match_players details */}
          <p style={{ color: 'var(--color-text-muted)' }}>Solo el creador puede ver la lista completa en esta versión.</p>
          
          {!isCreator && !match.has_joined && (
             <button className="btn btn-primary" style={{ marginTop: '1rem', width: '100%' }} onClick={async () => {
               await matchesAPI.requestJoin(match.id);
               alert('Solicitud enviada');
             }}>
               Solicitar Unirse
             </button>
          )}
          {match.has_joined && (
             <button className="btn btn-secondary" style={{ marginTop: '1rem', width: '100%' }}>
               Ya estás unido
             </button>
          )}
        </div>
      )}

      {activeTab === 'chat' && (
        <div style={{ display: 'flex', flexDirection: 'column', height: '400px' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', background: '#f9f9f9', borderRadius: '8px', marginBottom: '1rem' }}>
            {messages.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#999' }}>No hay mensajes aún.</p>
            ) : (
              messages.map(msg => (
                <div key={msg.id} style={{ marginBottom: '0.5rem', textAlign: msg.user_id === user?.id ? 'right' : 'left' }}>
                  <span style={{ fontSize: '0.8rem', color: '#666' }}>{msg.profiles?.name || 'Usuario'}</span>
                  <div style={{ 
                    display: 'inline-block', 
                    padding: '0.5rem 1rem', 
                    background: msg.user_id === user?.id ? 'var(--color-primary)' : '#e0e0e0',
                    color: msg.user_id === user?.id ? 'white' : 'black',
                    borderRadius: '15px',
                    marginLeft: msg.user_id === user?.id ? 'auto' : '0'
                  }}>
                    {msg.message}
                  </div>
                </div>
              ))
            )}
          </div>
          <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '0.5rem' }}>
            <input 
              type="text" 
              value={newMessage} 
              onChange={e => setNewMessage(e.target.value)}
              placeholder="Escribe un mensaje..." 
              className="form-input" 
              style={{ flex: 1 }}
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
                  {req.profiles?.ranking && <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', color: '#666' }}>⭐ {req.profiles.ranking}</span>}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn btn-sm btn-primary" onClick={() => handleApprove(req.id, req.user_id)}>Aceptar</button>
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
