import { useState, useEffect } from 'react';
import { notificationsAPI, matchesAPI } from '../services/api';
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
  const navigate = useNavigate();

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const data = await notificationsAPI.getMine();
      setNotifications(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationClick = async (notif) => {
    // For notifications without actions, navigate
    if (notif.type !== 'join_request_received') {
      if (!notif.is_read) {
        await notificationsAPI.markAsRead(notif.id);
        // Also update the state to show it as read immediately
        setNotifications(notifications.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
      }
      let path = null;
      if (notif.data) {
          if (typeof notif.data === 'string' && notif.data.startsWith('/')) {
              path = notif.data;
          } else if (typeof notif.data === 'object' && notif.data.path && typeof notif.data.path === 'string' && notif.data.path.startsWith('/')) {
              path = notif.data.path;
          }
      }
      if (path) {
        if (notif.type === 'new_chat_message') {
          navigate(path, { state: { openTab: 'chat' } });
        } else {
          navigate(path);
        }
      }
    }
    // For join requests, the action is handled by buttons, but we can still mark as read on click
    else if (!notif.is_read) {
       await notificationsAPI.markAsRead(notif.id);
       setNotifications(notifications.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
    }
  };

  const handleRequestAction = async (notif, action) => {
    // The 'data' field for a join request should contain requestId, matchId, and userId
    // This is an assumption based on the API. If this is not the case, this will fail.
    const { requestId, matchId, userId } = notif.data;

    if (!requestId || !matchId || !userId) {
      console.error('Notification data is missing required fields for this action.', notif.data);
      return;
    }

    setProcessingNotifId(notif.id);
    try {
      if (action === 'accept') {
        await matchesAPI.approveRequest(requestId, matchId, userId);
      } else {
        await matchesAPI.rejectRequest(requestId, matchId, userId);
      }
      // Optimistically hide the actions and mark as read
      setNotifications(notifications.map(n => 
        n.id === notif.id 
        ? { ...n, is_read: true, handled: true } 
        : n
      ));
    } catch (err) {
      console.error(`Failed to ${action} request`, err);
    } finally {
      setProcessingNotifId(null);
      // Optionally, you could reload all notifications here with loadNotifications()
      // but optimistic update is faster.
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
          {notifications.map(notif => (
            <div 
              key={notif.id} 
              className={`notification-item ${notif.is_read ? 'is-read' : ''}`}
              onClick={() => handleNotificationClick(notif)}
            >
              <div className="notification-icon">
                {notificationIcons[notif.type] || notificationIcons.default}
              </div>
              <div className="notification-content">
                <p>{notif.content}</p>
                <span className="notification-date">
                  {new Date(notif.created_at).toLocaleString()}
                </span>
                
                {notif.type === 'join_request_received' && !notif.handled && typeof notif.data === 'object' && (
                  <div className="notification-actions">
                    {processingNotifId === notif.id ? (
                      <div className="spinner-sm"></div>
                    ) : (
                      <>
                        <button 
                          className="btn btn-sm btn-primary" 
                          onClick={(e) => { e.stopPropagation(); handleRequestAction(notif, 'accept'); }}
                        >
                          Aceptar
                        </button>
                        <button 
                          className="btn btn-sm btn-danger" 
                          onClick={(e) => { e.stopPropagation(); handleRequestAction(notif, 'reject'); }}
                        >
                          Rechazar
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
