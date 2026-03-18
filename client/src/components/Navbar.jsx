import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <nav className="bottom-nav">
      <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} end>
        <span className="nav-icon">⚽</span>
        <span>Solicitudes</span>
      </NavLink>

      <NavLink to="/venues" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <span className="nav-icon">🏟️</span>
        <span>Canchas</span>
      </NavLink>

      <button
        className="nav-item nav-create"
        onClick={() => {
          user ? navigate('/create-match') : navigate('/login');
        }}
        aria-label="Publicar"
      >
        <span className="nav-icon">+</span>
        <span>Publicar</span>
      </button>

      <NavLink
        to={user ? '/profile' : '/login'}
        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
      >
        <span className="nav-icon">👤</span>
        <span>{user ? 'Perfil' : 'Entrar'}</span>
      </NavLink>
    </nav>
  );
}
