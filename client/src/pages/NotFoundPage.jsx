import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div className="page-content">
      <div className="empty-state">
        <div className="empty-state-icon">❓</div>
        <div className="empty-state-title">Página no encontrada</div>
        <p style={{ color: 'var(--color-text-muted)' }}>La ruta que intentaste abrir no existe.</p>
        <div style={{ marginTop: '1rem' }}>
          <button className="btn btn-primary" onClick={() => navigate('/')}>Volver al inicio</button>
        </div>
      </div>
    </div>
  );
}

