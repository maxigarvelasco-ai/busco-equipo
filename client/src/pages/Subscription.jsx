import { useAuth } from '../context/AuthContext';
import { subscriptionsAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';

export default function Subscription() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [currentSub, setCurrentSub] = useState(null);
  const [checkingPro, setCheckingPro] = useState(true);

  useEffect(() => {
    checkSubscription();
  }, []);

  async function checkSubscription() {
    try {
      const sub = await subscriptionsAPI.getMine();
      setCurrentSub(sub);
    } catch { }
    setCheckingPro(false);
  }

  const isPro = currentSub && new Date(currentSub.expires_at) > new Date();

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      await subscriptionsAPI.subscribe('pro', 2000);
      setToast({ message: '¡Ya sos Pro! 🎉', type: 'success' });
      setTimeout(() => navigate('/profile'), 2000);
    } catch (err) {
      setToast({ message: err.message || 'Error al suscribirse', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  if (checkingPro) {
    return <div className="page-content"><div className="loading-spinner"><div className="spinner"></div></div></div>;
  }

  if (isPro) {
    return (
      <div className="page-content">
        <div className="empty-state">
          <div className="empty-state-icon">⭐</div>
          <div className="empty-state-title">¡Ya sos Pro!</div>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem' }}>Disfrutá de todos los beneficios de tu suscripción.</p>
          <button className="btn btn-primary" onClick={() => navigate('/')}>Ir a Partidos</button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content">
      {toast && <div className={`toast toast-${toast.type}`}>{toast.message}</div>}

      <div className="page-header">
        <h1 className="page-title">Organizador Pro</h1>
      </div>

      <div className="subscription-card">
        <span className="badge badge-pro">⭐ PRO</span>
        <div className="subscription-price">
          $2.000 <span>/ mes</span>
        </div>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
          Todo lo que necesitás para organizar partidos como un profesional
        </p>

        <ul className="subscription-features">
          <li>Partidos destacados ilimitados</li>
          <li>Crear torneos</li>
          <li>Estadísticas avanzadas de partidos</li>
          <li>Grupos privados de partidos</li>
          <li>Badge Pro en tu perfil</li>
          <li>Soporte prioritario</li>
        </ul>

        <button
          className="btn btn-gold btn-lg btn-full"
          onClick={handleSubscribe}
          disabled={loading}
        >
          {loading ? 'Procesando...' : '⭐ Suscribirme a Pro'}
        </button>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)', marginTop: '0.75rem' }}>
          Podés cancelar en cualquier momento
        </p>
      </div>

      <div style={{ marginTop: 'var(--space-2xl)' }}>
        <h3 style={{ marginBottom: 'var(--space-lg)' }}>Comparar planes</h3>
        <div className="card">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-sm)' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem', borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>Característica</th>
                <th style={{ textAlign: 'center', padding: '0.75rem 0.5rem', borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>Free</th>
                <th style={{ textAlign: 'center', padding: '0.75rem 0.5rem', borderBottom: '1px solid var(--color-border)', color: 'var(--color-gold)' }}>Pro</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Unirse a partidos', '✅', '✅'],
                ['Crear partidos', '✅', '✅'],
                ['Destacar partidos', '💰', '♾️'],
                ['Crear torneos', '❌', '✅'],
                ['Estadísticas', '❌', '✅'],
                ['Grupos privados', '❌', '✅'],
              ].map(([feat, free, pro], i) => (
                <tr key={i}>
                  <td style={{ padding: '0.75rem 0.5rem', borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>{feat}</td>
                  <td style={{ textAlign: 'center', padding: '0.75rem 0.5rem', borderBottom: '1px solid var(--color-border)' }}>{free}</td>
                  <td style={{ textAlign: 'center', padding: '0.75rem 0.5rem', borderBottom: '1px solid var(--color-border)' }}>{pro}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
