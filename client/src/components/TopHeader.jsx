import { useNavigate } from 'react-router-dom';

export default function TopHeader() {
  const navigate = useNavigate();

  return (
    <header className="top-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 1rem' }}>
      <div className="top-header-logo" onClick={() => navigate('/')} style={{ cursor: 'pointer', margin: 0 }}>
        ⚽ Busco<span>Equipo</span>
      </div>
      <div style={{ width: 24 }} />
    </header>
  );
}
