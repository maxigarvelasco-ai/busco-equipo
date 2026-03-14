import { useState, useEffect } from 'react';
import { notificationsAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
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
    if (!notif.is_read) {
      await notificationsAPI.markAsRead(notif.id);
    }
    if (notif.data && typeof notif.data === 'string' && notif.data.startsWith('/')) {
      // If it's a join request, navigate to the match detail page and open the requests tab
      if (notif.type === 'join_request_received') {
        navigate(notif.data, { state: { openTab: 'requests' } });
      } else {
        navigate(notif.data);
      }
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {notifications.map(notif => (
            <div 
              key={notif.id} 
              className="card" 
              style={{ 
                cursor: notif.data ? 'pointer' : 'default',
                background: notif.is_read ? 'white' : '#e6fffa',
                borderLeft: notif.is_read ? 'none' : '4px solid var(--color-primary)'
              }}
              onClick={() => handleNotificationClick(notif)}
            >
              <p style={{ margin: 0 }}>{notif.content}</p>
              <span style={{ fontSize: '0.8rem', color: '#888' }}>
                {new Date(notif.created_at).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
