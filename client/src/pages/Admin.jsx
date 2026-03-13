import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { adminAPI } from '../services/api';

export default function Admin() {
  const { token } = useAuth();
  const [tab, setTab] = useState('metrics');
  const [metrics, setMetrics] = useState(null);
  const [settings, setSettings] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    fetchData();
  }, [tab]);

  async function fetchData() {
    setLoading(true);
    try {
      if (tab === 'metrics') {
        const data = await adminAPI.getMetrics(token);
        setMetrics(data);
      } else if (tab === 'settings') {
        const data = await adminAPI.getSettings(token);
        setSettings(data);
      } else if (tab === 'users') {
        const data = await adminAPI.getUsers(token);
        setUsers(data);
      }
    } catch {
      // Use demo data if backend not available
      if (tab === 'metrics') setMetrics(getDemoMetrics());
      if (tab === 'settings') setSettings(getDemoSettings());
      if (tab === 'users') setUsers(getDemoUsers());
    } finally {
      setLoading(false);
    }
  }

  const showToast = (msg, type = 'success') => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSaveSettings = async () => {
    try {
      await adminAPI.updateSettings(settings, token);
      showToast('Configuración guardada');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="page-content">
      {toast && <div className={`toast toast-${toast.type}`}>{toast.message}</div>}

      <div className="page-header">
        <h1 className="page-title">Admin</h1>
      </div>

      <div className="tabs">
        {[
          { key: 'metrics', label: '📊 Métricas' },
          { key: 'settings', label: '⚙️ Config' },
          { key: 'users', label: '👥 Usuarios' },
        ].map(t => (
          <button key={t.key} className={`tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-spinner"><div className="spinner"></div></div>
      ) : (
        <>
          {tab === 'metrics' && metrics && (
            <>
              <div className="metrics-grid">
                <MetricCard value={metrics.total_users} label="Usuarios" />
                <MetricCard value={metrics.total_matches} label="Partidos" />
                <MetricCard value={metrics.active_venues} label="Canchas" />
                <MetricCard value={metrics.total_tournaments} label="Torneos" />
                <MetricCard value={metrics.active_subscriptions} label="Suscripciones" />
                <MetricCard value={metrics.active_featured} label="Destacados" />
              </div>

              {metrics.revenue && (
                <div className="card" style={{ marginTop: 'var(--space-lg)' }}>
                  <h3 style={{ marginBottom: '1rem' }}>💰 Ingresos</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <RevenueRow label="Partidos destacados" value={metrics.revenue.featured_revenue} />
                    <RevenueRow label="Suscripciones" value={metrics.revenue.subscription_revenue} />
                    <RevenueRow label="Canchas" value={metrics.revenue.venue_revenue} />
                  </div>
                </div>
              )}
            </>
          )}

          {tab === 'settings' && settings && (
            <div className="card">
              <h3 style={{ marginBottom: '1.5rem' }}>Precios</h3>
              {Object.entries(settings).map(([key, value]) => (
                <div className="form-group" key={key}>
                  <label className="form-label">{formatSettingKey(key)}</label>
                  <input
                    className="form-input"
                    value={value}
                    onChange={e => setSettings({ ...settings, [key]: e.target.value })}
                  />
                </div>
              ))}
              <button className="btn btn-primary btn-full" onClick={handleSaveSettings}>
                Guardar Configuración
              </button>
            </div>
          )}

          {tab === 'users' && (
            <div>
              {users.map(u => (
                <div key={u.id} className="card" style={{ marginBottom: 'var(--space-md)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{u.name}</div>
                      <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>{u.email}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      {u.subscription_type === 'pro' && <span className="badge badge-pro">Pro</span>}
                      {u.role === 'admin' && <span className="badge badge-featured">Admin</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MetricCard({ value, label }) {
  return (
    <div className="metric-card animate-in">
      <div className="metric-value">{value}</div>
      <div className="metric-label">{label}</div>
    </div>
  );
}

function RevenueRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>{label}</span>
      <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>${parseFloat(value || 0).toLocaleString()} ARS</span>
    </div>
  );
}

function formatSettingKey(key) {
  const map = {
    featured_price: '💫 Precio partido destacado (ARS)',
    pro_monthly_price: '⭐ Suscripción Pro mensual (ARS)',
    venue_basic_price: '🏟️ Cancha básica mensual (ARS)',
    venue_premium_price: '🏟️ Cancha premium mensual (ARS)',
    currency: '💱 Moneda',
  };
  return map[key] || key;
}

function getDemoMetrics() {
  return { total_users: 156, total_matches: 48, active_venues: 12, total_tournaments: 3, active_subscriptions: 8, active_featured: 5, revenue: { featured_revenue: 12500, subscription_revenue: 16000, venue_revenue: 80000 } };
}

function getDemoSettings() {
  return { featured_price: '500', pro_monthly_price: '2000', venue_basic_price: '10000', venue_premium_price: '30000', currency: 'ARS' };
}

function getDemoUsers() {
  return [
    { id: 1, name: 'Admin', email: 'admin@buscoequipo.com', role: 'admin', subscription_type: 'pro', matches_played: 12 },
    { id: 2, name: 'Martín López', email: 'martin@email.com', role: 'user', subscription_type: 'pro', matches_played: 25 },
    { id: 3, name: 'Lucas García', email: 'lucas@email.com', role: 'user', subscription_type: 'free', matches_played: 8 },
  ];
}
