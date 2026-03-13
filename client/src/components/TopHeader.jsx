import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function TopHeader() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="top-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 1rem' }}>
      <div className="top-header-logo" onClick={() => navigate('/')} style={{ cursor: 'pointer', margin: 0 }}>
        ⚽ Busco<span>Equipo</span>
      </div>
      {user && (
        <div onClick={() => navigate('/notifications')} style={{ cursor: 'pointer', fontSize: '1.5rem' }}>
          🔔
        </div>
      )}
    </header>
  );
}
