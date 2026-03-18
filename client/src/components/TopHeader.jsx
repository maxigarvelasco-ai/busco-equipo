import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { notificationsAPI, profilesAPI, supportAPI } from '../services/api';
import { useUI } from '../context/UIContext';

export default function TopHeader() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { theme, toggleTheme, language, setLanguage, t } = useUI();
  const locale = language === 'en' ? 'en-US' : language === 'pt' ? 'pt-BR' : 'es-AR';
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [suggestionOpen, setSuggestionOpen] = useState(false);
  const [suggestionText, setSuggestionText] = useState('');
  const [sendingSuggestion, setSendingSuggestion] = useState(false);
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
    if (!searchOpen && !notifOpen && !menuOpen) return;
    function handleOutsideClick(e) {
      if (topActionsRef.current && !topActionsRef.current.contains(e.target)) {
        setSearchOpen(false);
        setNotifOpen(false);
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [searchOpen, notifOpen, menuOpen]);

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
      setSearchStatus(t('search_min_chars'));
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      setSearchStatus('');
      try {
        const listGlobal = await profilesAPI.searchGlobal(q, user.id);
        setSearchResults(listGlobal || []);
        if (!listGlobal?.length) {
          setSearchStatus(t('no_results'));
        }
      } catch {
        setSearchResults([]);
        setSearchStatus(t('search_unavailable'));
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchOpen, searchTerm, user, t]);

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
      setSearchStatus(t('contact_added_status'));
    } catch {
      setSearchStatus(t('contact_add_error'));
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

  function goToSearchResult(item) {
    setSearchOpen(false);
    setNotifOpen(false);
    setMenuOpen(false);
    setSearchTerm('');

    if (item?.entityType === 'profile') {
      navigate(`/users/${item.entityId}`);
      return;
    }
    if (item?.entityType === 'club') {
      if (item.ownerId) {
        navigate(`/users/${item.ownerId}`);
      } else {
        navigate('/');
      }
      return;
    }
    if (item?.entityType === 'venue') {
      navigate('/venues', { state: { focusVenueId: item.entityId } });
      return;
    }
  }

  async function handleSendSuggestion() {
    if (!user) {
      navigate('/login');
      return;
    }
    if (!suggestionText.trim()) {
      setSearchStatus(t('suggestion_error'));
      return;
    }

    setSendingSuggestion(true);
    try {
      await supportAPI.sendSuggestion(suggestionText.trim());
      setSuggestionText('');
      setSuggestionOpen(false);
      setMenuOpen(false);
      setSearchStatus(t('suggestion_sent'));
    } catch {
      setSearchStatus(t('suggestion_error'));
    } finally {
      setSendingSuggestion(false);
    }
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
    <header className="top-header top-header-custom" ref={topActionsRef} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 1rem' }}>
      {menuOpen && <button type="button" className="header-menu-backdrop" onClick={() => setMenuOpen(false)} aria-label={t('menu')} />}

      <div className="top-header-actions">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          style={{ minWidth: 44, height: 36, padding: '0 0.7rem' }}
          onClick={() => {
            setMenuOpen((prev) => !prev);
            setSearchOpen(false);
            setNotifOpen(false);
          }}
          aria-label={t('menu')}
          title={t('menu')}
        >
          ☰
        </button>

        {menuOpen && (
          <div className="header-menu-panel" role="dialog" aria-modal="true" aria-label={t('menu_title')}>
            <div className="header-menu-title">{t('menu_title')}</div>

            <button className="btn btn-secondary btn-sm" type="button" onClick={toggleTheme}>
              {theme === 'dark' ? t('light_mode') : t('dark_mode')}
            </button>

            <div className="header-lang-row">
              <span>{t('language')}:</span>
              <button className={`btn btn-sm ${language === 'es' ? 'btn-primary' : 'btn-secondary'}`} type="button" onClick={() => setLanguage('es')}>ES</button>
              <button className={`btn btn-sm ${language === 'en' ? 'btn-primary' : 'btn-secondary'}`} type="button" onClick={() => setLanguage('en')}>EN</button>
              <button className={`btn btn-sm ${language === 'pt' ? 'btn-primary' : 'btn-secondary'}`} type="button" onClick={() => setLanguage('pt')}>PT</button>
            </div>

            <button className="btn btn-secondary btn-sm" type="button" onClick={() => { setMenuOpen(false); navigate('/support'); }}>
              {t('app_policies')}
            </button>

            <button className="btn btn-secondary btn-sm" type="button" onClick={() => setSuggestionOpen((v) => !v)}>
              {t('send_suggestion')}
            </button>

            {suggestionOpen && (
              <div className="header-suggestion-box">
                <textarea
                  className="form-textarea"
                  value={suggestionText}
                  onChange={(e) => setSuggestionText(e.target.value)}
                  placeholder={t('suggestion_placeholder')}
                />
                <div className="header-suggestion-actions">
                  <button className="btn btn-secondary btn-sm" type="button" onClick={() => setSuggestionOpen(false)}>{t('cancel')}</button>
                  <button className="btn btn-primary btn-sm" type="button" onClick={handleSendSuggestion} disabled={sendingSuggestion}>
                    {sendingSuggestion ? t('save_in_progress') : t('send')}
                  </button>
                </div>
              </div>
            )}

            {user && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={async () => {
                  await logout();
                  navigate('/login');
                }}
              >
                {t('logout')}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="top-header-logo" onClick={() => navigate('/')} style={{ cursor: 'pointer', margin: 0 }}>
        ⚽ Busco<span>Equipo</span>
      </div>

      <div className="top-header-actions">
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
            setNotifOpen(false);
            setMenuOpen(false);
          }}
          aria-label={t('search_placeholder')}
          title={t('search_placeholder')}
        >
          🔎
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          style={{ minWidth: 44, height: 36, position: 'relative', padding: '0 0.7rem' }}
          onClick={openNotificationsPanel}
          aria-label={t('notifications')}
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
        {searchOpen && user && (
          <div className="header-search-panel">
            <div className="header-search-input-wrap">
              <input
                className="form-input"
                placeholder={t('search_placeholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
              />
            </div>

            <div className="header-search-results">
              {searching ? (
                <div className="header-search-empty">{t('searching')}</div>
              ) : searchResults.length > 0 ? (
                searchResults.map((p) => {
                  const added = !!addedContacts[p.entityId || p.id];
                  const location = p.subtitle || t('no_location');
                  return (
                    <div key={p.id} className="header-search-item">
                      <div>
                        <div className="header-search-name">{p.name || t('no_name')}</div>
                        <div className="header-search-meta">{location}</div>
                      </div>
                      <div className="header-search-actions">
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => goToSearchResult(p)}>
                          {t('view')}
                        </button>
                        {p.entityType === 'profile' ? (
                          <>
                            <button type="button" className="btn btn-primary btn-sm" onClick={() => goToUserProfile(p.entityId || p.id)}>
                              {t('message')}
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              disabled={added || addingContactId === (p.entityId || p.id)}
                              onClick={() => handleAddContact(p.entityId || p.id)}
                            >
                              {added ? t('added') : (addingContactId === (p.entityId || p.id) ? t('save_in_progress') : t('contact'))}
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="header-search-empty">{searchStatus || t('search_empty')}</div>
              )}
            </div>
          </div>
        )}

        {notifOpen && user && (
          <div className="header-notif-panel">
            <div className="header-notif-head">
              <strong>{t('notifications')}</strong>
              <button className="btn btn-secondary btn-sm" type="button" onClick={() => navigate('/notifications')}>
                {t('view_all')}
              </button>
            </div>
            <div className="header-notif-list">
              {notifLoading ? (
                <div className="header-search-empty">{t('loading')}</div>
              ) : notifItems.length === 0 ? (
                <div className="header-search-empty">{t('no_notifications')}</div>
              ) : (
                notifItems.slice(0, 8).map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    className={`header-notif-item ${n.is_read ? 'is-read' : ''}`}
                    onClick={() => handleNotifClick(n)}
                  >
                    <div className="header-search-name">{n.message || n.content || t('notification_fallback')}</div>
                    <div className="header-search-meta">{new Date(n.created_at).toLocaleString(locale)}</div>
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
