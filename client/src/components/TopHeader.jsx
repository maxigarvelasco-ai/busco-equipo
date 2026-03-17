import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { notificationsAPI, profilesAPI } from '../services/api';

export default function TopHeader() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifItems, setNotifItems] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [addedContacts, setAddedContacts] = useState({});
  const [addingContactId, setAddingContactId] = useState(null);
  const [searchStatus, setSearchStatus] = useState('');
  const topActionsRef = useRef(null);

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

  useEffect(() => {
    if (!searchOpen && !notifOpen) return;
    function handleOutsideClick(e) {
      if (topActionsRef.current && !topActionsRef.current.contains(e.target)) {
        setSearchOpen(false);
        setNotifOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [searchOpen, notifOpen]);

  useEffect(() => {
    if (!searchOpen) return;
    if (!user) return;

    const q = searchTerm.trim();
    if (!q) {
      setSearchResults([]);
      setSearchStatus('');
      return;
    }

    if (q.length < 2) {
      setSearchResults([]);
      setSearchStatus('Escribi al menos 2 letras');
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      setSearchStatus('');
      try {
        const list = await profilesAPI.searchProfiles(q, user.id);
        setSearchResults(list || []);
        if (!list?.length) {
          setSearchStatus('No encontramos perfiles con ese texto');
        }
      } catch {
        setSearchResults([]);
        setSearchStatus('No se pudo buscar ahora');
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchOpen, searchTerm, user]);

  async function handleAddContact(profileId) {
    if (!user) {
      navigate('/login');
      return;
    }
    if (!profileId) return;
    setAddingContactId(profileId);
    try {
      await profilesAPI.addContact(profileId);
      setAddedContacts((prev) => ({ ...prev, [profileId]: true }));
      setSearchStatus('Contacto agregado. Ya podes escribirle por mensaje directo.');
    } catch {
      setSearchStatus('No se pudo agregar el contacto');
    } finally {
      setAddingContactId(null);
    }
  }

  function goToUserProfile(profileId) {
    setSearchOpen(false);
    setNotifOpen(false);
    setSearchTerm('');
    navigate(`/users/${profileId}`);
  }

  function resolveNotifPath(notif) {
    const data = notif?.data;
    if (!data || typeof data !== 'object') return null;
    if (typeof data.path === 'string' && data.path.startsWith('/')) return data.path;
    if (data.matchId || data.match_id || data.id) return `/match/${data.matchId || data.match_id || data.id}`;
    return null;
  }

  async function openNotificationsPanel() {
    if (!user) {
      navigate('/login');
      return;
    }

    const nextOpen = !notifOpen;
    setNotifOpen(nextOpen);
    setSearchOpen(false);
    if (!nextOpen) return;

    setNotifLoading(true);
    try {
      const list = await notificationsAPI.getMine();
      setNotifItems(list || []);
      setUnreadCount((list || []).filter((n) => !n.is_read).length);
    } catch {
      setNotifItems([]);
    } finally {
      setNotifLoading(false);
    }
  }

  async function handleNotifClick(notif) {
    try {
      if (!notif?.is_read) {
        await notificationsAPI.markAsRead(notif.id);
        setNotifItems((prev) => prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n)));
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch {
      // keep navigation behavior even if mark-as-read fails
    }

    const path = resolveNotifPath(notif);
    setNotifOpen(false);
    if (path) {
      navigate(path);
    } else {
      navigate('/notifications');
    }
  }

  return (
    <header className="top-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 1rem' }}>
      <div className="top-header-logo" onClick={() => navigate('/')} style={{ cursor: 'pointer', margin: 0 }}>
        ⚽ Busco<span>Equipo</span>
      </div>
      <div className="top-header-actions" ref={topActionsRef}>
        {user && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => navigate('/create-match')}
            aria-label="Crear partido"
          >
            +
          </button>
        )}
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          style={{ minWidth: 44, height: 36, padding: '0 0.7rem' }}
          onClick={() => {
            if (!user) {
              navigate('/login');
              return;
            }
            setSearchOpen((prev) => !prev);
          }}
          aria-label="Buscar perfiles"
          title="Buscar perfiles"
        >
          🔎
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          style={{ minWidth: 44, height: 36, position: 'relative', padding: '0 0.7rem' }}
          onClick={openNotificationsPanel}
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
        {user && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={async () => {
              await logout();
              navigate('/login');
            }}
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
          >
            Salir
          </button>
        )}

        {searchOpen && user && (
          <div className="header-search-panel">
            <div className="header-search-input-wrap">
              <input
                className="form-input"
                placeholder="Buscar por nombre, ciudad o zona"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
              />
            </div>

            <div className="header-search-results">
              {searching ? (
                <div className="header-search-empty">Buscando...</div>
              ) : searchResults.length > 0 ? (
                searchResults.map((p) => {
                  const added = !!addedContacts[p.id];
                  const location = [p.city, p.zone].filter(Boolean).join(' - ') || 'Sin ubicacion';
                  return (
                    <div key={p.id} className="header-search-item">
                      <div>
                        <div className="header-search-name">{p.name || 'Sin nombre'}</div>
                        <div className="header-search-meta">{location}</div>
                      </div>
                      <div className="header-search-actions">
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => goToUserProfile(p.id)}>
                          Ver
                        </button>
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => goToUserProfile(p.id)}>
                          Mensaje
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={added || addingContactId === p.id}
                          onClick={() => handleAddContact(p.id)}
                        >
                          {added ? 'Agregado' : (addingContactId === p.id ? 'Guardando...' : 'Contacto')}
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="header-search-empty">{searchStatus || 'Empeza a escribir para buscar perfiles.'}</div>
              )}
            </div>
          </div>
        )}

        {notifOpen && user && (
          <div className="header-notif-panel">
            <div className="header-notif-head">
              <strong>Notificaciones</strong>
              <button className="btn btn-secondary btn-sm" type="button" onClick={() => navigate('/notifications')}>
                Ver todas
              </button>
            </div>
            <div className="header-notif-list">
              {notifLoading ? (
                <div className="header-search-empty">Cargando...</div>
              ) : notifItems.length === 0 ? (
                <div className="header-search-empty">No hay notificaciones</div>
              ) : (
                notifItems.slice(0, 8).map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    className={`header-notif-item ${n.is_read ? 'is-read' : ''}`}
                    onClick={() => handleNotifClick(n)}
                  >
                    <div className="header-search-name">{n.message || n.content || 'Notificación'}</div>
                    <div className="header-search-meta">{new Date(n.created_at).toLocaleString('es-AR')}</div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
