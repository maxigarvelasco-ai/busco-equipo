import { useState } from 'react';
import { reportsAPI } from '../services/api';
import { useUI } from '../context/UIContext';

export default function ReportModal({ reportedUserId, reportedUserName, onClose }) {
  const { language } = useUI();
  const i18n = {
    es: {
      r1: 'No se presento al partido',
      r2: 'Comportamiento inadecuado',
      r3: 'Juego brusco o violento',
      r4: 'Perfil falso o spam',
      r5: 'Otro',
      sent: 'Reporte enviado correctamente.',
      send_error: 'Error al enviar reporte',
      title: 'Reportar a',
      reason: 'Motivo',
      details: 'Detalles (opcional)',
      details_ph: 'Explica lo que paso...',
      cancel: 'Cancelar',
      sending: 'Enviando...',
      report: 'Reportar',
    },
    en: {
      r1: 'Did not show up to the match',
      r2: 'Inappropriate behavior',
      r3: 'Rough or violent play',
      r4: 'Fake profile or spam',
      r5: 'Other',
      sent: 'Report sent successfully.',
      send_error: 'Failed to send report',
      title: 'Report',
      reason: 'Reason',
      details: 'Details (optional)',
      details_ph: 'Explain what happened...',
      cancel: 'Cancel',
      sending: 'Sending...',
      report: 'Report',
    },
    pt: {
      r1: 'Nao compareceu na partida',
      r2: 'Comportamento inadequado',
      r3: 'Jogo brusco ou violento',
      r4: 'Perfil falso ou spam',
      r5: 'Outro',
      sent: 'Denuncia enviada com sucesso.',
      send_error: 'Erro ao enviar denuncia',
      title: 'Denunciar',
      reason: 'Motivo',
      details: 'Detalhes (opcional)',
      details_ph: 'Explique o que aconteceu...',
      cancel: 'Cancelar',
      sending: 'Enviando...',
      report: 'Denunciar',
    },
  }[language];

  const [reason, setReason] = useState(i18n.r1);
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason) return;

    try {
      setLoading(true);
      await reportsAPI.reportUser(reportedUserId, reason, details);
      alert(i18n.sent);
      onClose();
    } catch (err) {
      alert(err.message || i18n.send_error);
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
        <h3 style={{ marginTop: 0 }}>{i18n.title} {reportedUserName}</h3>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>{i18n.reason}</label>
            <select className="form-input" value={reason} onChange={e => setReason(e.target.value)}>
              <option value={i18n.r1}>{i18n.r1}</option>
              <option value={i18n.r2}>{i18n.r2}</option>
              <option value={i18n.r3}>{i18n.r3}</option>
              <option value={i18n.r4}>{i18n.r4}</option>
              <option value={i18n.r5}>{i18n.r5}</option>
            </select>
          </div>

          <div className="form-group">
            <label>{i18n.details}</label>
            <textarea 
              className="form-input" 
              rows="3"
              value={details} 
              onChange={e => setDetails(e.target.value)}
              placeholder={i18n.details_ph}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
            <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>{i18n.cancel}</button>
            <button type="submit" className="btn btn-primary" style={{ flex: 1, background: 'var(--color-danger)' }} disabled={loading}>
              {loading ? i18n.sending : i18n.report}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
