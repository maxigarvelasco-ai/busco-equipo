import { useState, useEffect } from 'react';
import { notificationsAPI, matchesAPI } from '../services/api';
import { supabase } from '../services/supabaseClient';
import { useNavigate } from 'react-router-dom';

// Icons for different notification types
const notificationIcons = {
  new_chat_message: (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
    </svg>
  ),
  join_request_received: (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
      <circle cx="8.5" cy="7" r="4"></circle>
      <line x1="20" y1="8" x2="20" y2="14"></line>
      <line x1="17" y1="11" x2="23" y2="11"></line>
    </svg>
  ),
  default: (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3zm-8.27 4a2 2 0 0 1-3.46 0"></path>
    </svg>
  )
};


export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingNotifId, setProcessingNotifId] = useState(null);
  const [expandedNotifId, setExpandedNotifId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadNotifications();

    // Real-time subscription: listen for new notifications and updates for this user
    let subs = null;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;
        if (!userId) return;

        subs = supabase.channel(`notifications_page_${userId}`)
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, (payload) => {
            const n = payload.new || payload.record || null;
            if (!n) return;
            // normalize data like loadNotifications
            let parsed = n.data;
            if (typeof parsed === 'string') {
              try { parsed = JSON.parse(parsed); } catch (e) { parsed = null; }
            }
            if (!parsed || typeof parsed !== 'object') parsed = parsed || {};
            const parsedData = {
              requestId: parsed.requestId || parsed.request_id || parsed.requestid || parsed.request_id,
              matchId: parsed.matchId || parsed.match_id || parsed.matchid || parsed.match_id,
              userId: parsed.userId || parsed.user_id || parsed.userid || parsed.user_id,
              path: parsed.path || parsed.url || parsed.route || null,
              raw: parsed,
            };
            const newNotif = { ...n, data: parsed, parsedData };
            setNotifications(prev => [newNotif, ...prev]);
          })
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, (payload) => {
            const n = payload.new || payload.record || null;
            if (!n) return;
            setNotifications(prev => prev.map(p => p.id === n.id ? { ...p, ...n } : p));
          })
          .subscribe();
      } catch (e) {
        console.error('Realtime notifications subscription failed', e);
      }
    })();

    return () => { if (subs) supabase.removeChannel(subs); };
  }, []);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const data = await notificationsAPI.getMine();
      // Normalize notif.data: parse JSON strings and provide common key aliases
      const normalized = (data || []).map(n => {
        let parsed = n.data;
        if (typeof parsed === 'string') {
          try { parsed = JSON.parse(parsed); } catch (e) { parsed = null; }
        }
        if (!parsed || typeof parsed !== 'object') parsed = parsed || {};

        // Normalize keys: accept requestId/request_id, matchId/match_id, userId/user_id
        const parsedData = {
          requestId: parsed.requestId || parsed.request_id || parsed.requestid || parsed.request_id,
          matchId: parsed.matchId || parsed.match_id || parsed.matchid || parsed.match_id,
          userId: parsed.userId || parsed.user_id || parsed.userid || parsed.user_id,
          path: parsed.path || parsed.url || parsed.route || null,
          raw: parsed,
        };

        return { ...n, data: parsed, parsedData };
      });

      setNotifications(normalized);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationClick = async (notif) => {
    // Ensure the notification expands on first click so actions are visible
    setExpandedNotifId(notif.id);
    // mark as read and log for debugging
    try {
      if (!notif.is_read) {
        await notificationsAPI.markAsRead(notif.id);
        setNotifications(notifications.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
      }
    } catch (err) {
      console.error('Failed to mark notification as read', err);
    }

    console.log('Notification clicked:', notif);
    // Do not auto-navigate here — expanding shows the action buttons.
  };

  const resolveNotifPath = (notif) => {
    if (!notif || !notif.data) return null;
    try {
      if (typeof notif.data === 'string') {
        const s = notif.data;
        if (s.startsWith('/')) return s;
        try {
          const parsed = JSON.parse(s);
          if (typeof parsed === 'string' && parsed.startsWith('/')) return parsed;
          if (parsed && typeof parsed === 'object') {
            if (parsed.path && parsed.path.startsWith('/')) return parsed.path;
            if (parsed.matchId || parsed.match_id || parsed.id) return `/match/${parsed.matchId || parsed.match_id || parsed.id}`;
          }
        } catch (e) {
          return null;
        }
      } else if (typeof notif.data === 'object') {
        if (notif.data.path && typeof notif.data.path === 'string' && notif.data.path.startsWith('/')) return notif.data.path;
        if (notif.data.matchId || notif.data.match_id || notif.data.id) return `/match/${notif.data.matchId || notif.data.match_id || notif.data.id}`;
      }
    } catch (err) {
      console.error('resolveNotifPath error', err);
    }
    return null;
  };

  const handleRequestAction = async (notif, action) => {
    // Use parsedData normalized at load time
    const { requestId, matchId, userId } = notif.parsedData || {};

    if (!requestId || !matchId || !userId) {
      console.error('Notification data is missing required fields for this action. notif id=', notif.id, notif.data);
      // mark notification with an error so UI shows a helpful message instead of an alert
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, errorMessage: 'Faltan datos para procesar la solicitud.' } : n));
      return;
    }

    setProcessingNotifId(notif.id);
    console.log('Processing request action', { action, requestId, matchId, userId });
    try {
      if (action === 'accept') {
        await matchesAPI.approveRequest(requestId, matchId, userId);
      } else {
        await matchesAPI.rejectRequest(requestId, matchId, userId);
      }
      // Persist handled/read on server
      try { await notificationsAPI.markHandled(notif.id); } catch (e) { console.error('Failed to persist notification handled flag', e); }

      // Update notification UI: mark handled and read
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true, handled: true } : n));
      console.log('Request action success', { action, requestId });
    } catch (err) {
      console.error(`Failed to ${action} request`, err);
      alert('Error al procesar la solicitud: ' + (err?.message || err?.details || 'ver consola'));
    } finally {
      setProcessingNotifId(null);
    }
  };

  const handleMarkAllRead = async () => {
    await notificationsAPI.markAllAsRead();
    loadNotifications();
  };

  if (loading) return <div className="loading-spinner"><div className="spinner"></div></div>;

  return (
    <div className="page-content">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="page-title">Notificaciones</h1>
        <button className="btn btn-sm btn-secondary" onClick={handleMarkAllRead}>Marcar todas como leídas</button>
      </div>

      {notifications.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📭</div>
          <div className="empty-state-title">No tienes notificaciones</div>
        </div>
      ) : (
        <div className="notification-list">
          {notifications.map(notif => {
            const path = resolveNotifPath(notif);
            return (
            <div
              key={notif.id}
              className={`notification-item ${notif.is_read ? 'is-read' : ''} ${expandedNotifId === notif.id ? 'is-expanded' : ''}`}
              onClick={() => {
                setExpandedNotifId(prev => prev === notif.id ? null : notif.id);
                handleNotificationClick(notif);
              }}
            >
              <div className="notification-icon">
                {notificationIcons[notif.type] || notificationIcons.default}
              </div>
              <div className="notification-content">
                <p>{notif.message || notif.content}</p>
                <span className="notification-date">
                  {new Date(notif.created_at).toLocaleString()}
                </span>
                
                {expandedNotifId === notif.id && (
                  <div className="notification-actions">
                    {processingNotifId === notif.id ? (
                      <div className="spinner-sm"></div>
                    ) : (
                      <>
                        {(notif.type === 'join_request_received' || notif.type === 'match_join_request') ? (
                          <>
                            {notif.handled ? (
                              <div className="notif-handled">Solicitud procesada</div>
                            ) : (
                              <>
                                <button
                                  className="btn btn-sm btn-primary"
                                  onClick={(e) => { e.stopPropagation(); handleRequestAction(notif, 'accept'); }}
                                  disabled={processingNotifId === notif.id}
                                >Aceptar</button>
                                <button
                                  className="btn btn-sm btn-danger"
                                  onClick={(e) => { e.stopPropagation(); handleRequestAction(notif, 'reject'); }}
                                  disabled={processingNotifId === notif.id}
                                >Rechazar</button>
                              </>
                            )}
                                {!(notif.parsedData && (notif.parsedData.requestId || notif.parsedData.matchId || notif.parsedData.userId)) && (
                              <div className="notif-no-action">Faltan datos de la solicitud para procesar (requestId/matchId/userId)</div>
                            )}
                            {notif.errorMessage && (
                              <div className="notif-error" style={{ color: 'orange', marginTop: '0.5rem' }}>{notif.errorMessage}</div>
                            )}
                          </>
                        ) : (
                          // non-join notifications: show navigation/action buttons when expanded
                          path ? (
                            <>
                              {notif.type === 'new_chat_message' ? (
                                <button
                                  className="btn btn-sm btn-primary"
                                  onClick={(e) => { e.stopPropagation(); navigate(path, { state: { openTab: 'chat' } }); }}
                                >Abrir chat</button>
                              ) : (
                                <button
                                  className="btn btn-sm btn-primary"
                                  onClick={(e) => { e.stopPropagation(); navigate(path); }}
                                >Ver</button>
                              )}
                            </>
                          ) : (
                            <div className="notif-no-action">Sin acción disponible</div>
                          )
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
