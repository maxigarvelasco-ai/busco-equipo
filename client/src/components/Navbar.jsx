import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabaseClient';
import { useState, useEffect } from 'react';

export default function Navbar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [showCreateMenu, setShowCreateMenu] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetchUnread = async () => {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
      setUnreadCount(count || 0);
    };
    fetchUnread();

    const subs = supabase.channel('notifications_nav')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, fetchUnread)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, fetchUnread)
      .subscribe();

    return () => { supabase.removeChannel(subs); }
  }, [user]);

  return (
    <nav className="bottom-nav">
      <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} end>
        <span className="nav-icon">⚽</span>
        <span>Partidos</span>
      </NavLink>

      <NavLink to="/venues" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <span className="nav-icon">🏟️</span>
        <span>Canchas</span>
      </NavLink>

      <button
        className="nav-item nav-create"
        onClick={() => user ? setShowCreateMenu((v) => !v) : navigate('/login')}
        aria-label="Crear"
      >
        <span>+</span>
      </button>

      <NavLink to="/clubs" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <span className="nav-icon">🛡️</span>
        <span>Clubes</span>
      </NavLink>

      <NavLink to="/notifications" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <span className="nav-icon">🔔</span>
          {unreadCount > 0 && (
            <span style={{
              position: 'absolute', top: -5, right: -10, background: 'red', color: 'white', 
              fontSize: '0.6rem', padding: '2px 5px', borderRadius: '10px', fontWeight: 'bold'
            }}>
              {unreadCount}
            </span>
          )}
        </div>
        <span>Avisos</span>
      </NavLink>

      <NavLink
        to={user ? '/profile' : '/login'}
        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
      >
        <span className="nav-icon">👤</span>
        <span>{user ? 'Perfil' : 'Entrar'}</span>
      </NavLink>

      {showCreateMenu && user && (
        <div style={{ position: 'fixed', bottom: 74, left: '50%', transform: 'translateX(-50%)', background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '0.5rem', display: 'grid', gap: '0.4rem', zIndex: 200 }}>
          <button className="btn btn-primary btn-sm" onClick={() => { setShowCreateMenu(false); navigate('/create-match'); }}>
            Crear partido
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => { setShowCreateMenu(false); navigate('/clubs', { state: { openCreateTeam: true } }); }}>
            Crear equipo
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => { setShowCreateMenu(false); navigate('/clubs', { state: { openCreateClub: true } }); }}>
            Crear club
          </button>
        </div>
      )}
    </nav>
  );
}
