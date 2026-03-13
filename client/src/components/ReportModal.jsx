import { useState } from 'react';
import { reportsAPI } from '../services/api';

export default function ReportModal({ reportedUserId, reportedUserName, onClose }) {
  const [reason, setReason] = useState('No se presentó al partido');
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason) return;

    try {
      setLoading(true);
      await reportsAPI.reportUser(reportedUserId, reason, details);
      alert('Reporte enviado correctamente.');
      onClose();
    } catch (err) {
      alert(err.message || 'Error al enviar reporte');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
      display: 'flex', justifyContent: 'center', alignItems: 'center'
    }}>
      <div className="card" style={{ width: '90%', maxWidth: '400px', padding: '1.5rem' }}>
        <h3 style={{ marginTop: 0 }}>Reportar a {reportedUserName}</h3>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Motivo</label>
            <select className="form-input" value={reason} onChange={e => setReason(e.target.value)}>
              <option value="No se presentó al partido">No se presentó al partido</option>
              <option value="Comportamiento inadecuado">Comportamiento inadecuado</option>
              <option value="Juego brusco/violento">Juego brusco/violento</option>
              <option value="Perfil falso/Spam">Perfil falso/Spam</option>
              <option value="Otro">Otro</option>
            </select>
          </div>

          <div className="form-group">
            <label>Detalles (Opcional)</label>
            <textarea 
              className="form-input" 
              rows="3"
              value={details} 
              onChange={e => setDetails(e.target.value)}
              placeholder="Explicá lo que pasó..."
            />
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
            <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" style={{ flex: 1, background: 'var(--color-danger)' }} disabled={loading}>
              {loading ? 'Enviando...' : 'Reportar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
