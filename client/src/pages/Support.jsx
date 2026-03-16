import { useState } from 'react';
import { supportAPI } from '../services/api';
import { useLocation, useNavigate } from 'react-router-dom';

export default function Support() {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const { state } = useLocation();
  const navigate = useNavigate();
  const openPolicy = state?.openPolicy;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;

    try {
      setLoading(true);
      await supportAPI.createTicket(subject, message);
      alert('Tu mensaje ha sido enviado al equipo de soporte. Te responderemos pronto.');
      navigate('/');
    } catch (err) {
      alert(err.message || 'Error al enviar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <button className="btn btn-sm btn-secondary" onClick={() => navigate(-1)}>Volver</button>
        <h1 className="page-title" style={{ marginTop: '0.5rem' }}>Soporte</h1>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0, marginBottom: '0.75rem' }}>Políticas de la app</h3>
        <div className="card" style={{ marginBottom: '1rem', borderColor: openPolicy === 'abandon' ? 'var(--color-primary)' : 'var(--color-border)' }}>
          <strong>Abandono de partido (3 horas antes)</strong>
          <p style={{ marginTop: '0.5rem' }}>
            Si un jugador abandona un partido dentro de las 3 horas previas al horario, queda bloqueado para volver a unirse a ese mismo partido.
          </p>
        </div>

        <p>¿Tuviste algún problema en un partido o necesitás ayuda con la app? Escribinos y lo solucionamos.</p>
        
        <form onSubmit={handleSubmit} style={{ marginTop: '1rem' }}>
          <div className="form-group">
            <label>Asunto</label>
            <input 
              required
              type="text" 
              className="form-input" 
              value={subject} 
              onChange={e => setSubject(e.target.value)}
              placeholder="Ej. Problema con un jugador, Error en pago"
            />
          </div>

          <div className="form-group">
            <label>Mensaje</label>
            <textarea 
              required
              className="form-input" 
              rows="5"
              value={message} 
              onChange={e => setMessage(e.target.value)}
              placeholder="Explicá la situación con detalle..."
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Enviando...' : 'Enviar Mensaje'}
          </button>
        </form>
      </div>
    </div>
  );
}
