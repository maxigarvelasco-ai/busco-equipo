import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';

export default function Navbar() {
  const { user } = useAuth();
  const { t } = useUI();
  const navigate = useNavigate();

  return (
    <nav className="bottom-nav">
      <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} end>
        <span className="nav-icon">⚽</span>
        <span>{t('requests')}</span>
      </NavLink>

      <NavLink to="/venues" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <span className="nav-icon">🏟️</span>
        <span>{t('courts')}</span>
      </NavLink>

      <button
        className="nav-item nav-create"
        onClick={() => {
          user ? navigate('/create-match') : navigate('/login');
        }}
        aria-label="Me faltan jugadores"
      >
        <span>{t('global_cta')}</span>
      </button>

      <NavLink
        to={user ? '/profile' : '/login'}
        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
      >
        <span className="nav-icon">👤</span>
        <span>{user ? t('profile') : t('account')}</span>
      </NavLink>
    </nav>
  );
}
