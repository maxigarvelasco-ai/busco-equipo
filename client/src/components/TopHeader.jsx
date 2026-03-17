import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { notificationsAPI } from '../services/api';

export default function TopHeader() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function loadUnread() {
      if (!user) {
        setUnreadCount(0);
        return;
      }
      try {
        const list = await notificationsAPI.getMine();
        if (!cancelled) {
          setUnreadCount((list || []).filter((n) => !n.is_read).length);
        }
      } catch {
        if (!cancelled) setUnreadCount(0);
      }
    }
    loadUnread();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <header className="top-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 1rem' }}>
      <div className="top-header-logo" onClick={() => navigate('/')} style={{ cursor: 'pointer', margin: 0 }}>
        ⚽ Busco<span>Equipo</span>
      </div>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        style={{ minWidth: 44, height: 36, position: 'relative', padding: '0 0.7rem' }}
        onClick={() => navigate(user ? '/notifications' : '/login')}
        aria-label="Notificaciones"
      >
        🔔
        {user && unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -6,
              right: -6,
              minWidth: 18,
              height: 18,
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--color-danger)',
              color: '#fff',
              border: '2px solid var(--color-bg)',
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
    </header>
  );
}
