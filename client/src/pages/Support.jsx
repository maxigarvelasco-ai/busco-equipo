import { useState } from 'react';
import { supportAPI } from '../services/api';
import { useLocation, useNavigate } from 'react-router-dom';
import { useUI } from '../context/UIContext';

export default function Support() {
  const { language } = useUI();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const { state } = useLocation();
  const navigate = useNavigate();
  const openPolicy = state?.openPolicy;
  const i18n = {
    es: {
      sent_ok: 'Tu mensaje fue enviado al equipo de soporte. Te responderemos pronto.',
      send_error: 'Error al enviar',
      back: 'Volver',
      title: 'Soporte',
      app_policies: 'Politicas de la app',
      abandon_title: 'Abandono de partido (3 horas antes)',
      abandon_desc: 'Si un jugador abandona un partido dentro de las 3 horas previas al horario, queda bloqueado para volver a unirse a ese mismo partido.',
      intro: 'Tuviste algun problema en un partido o necesitas ayuda con la app? Escribinos y lo solucionamos.',
      subject: 'Asunto',
      subject_ph: 'Ej. Problema con un jugador, error en pago',
      message: 'Mensaje',
      message_ph: 'Explica la situacion con detalle...',
      sending: 'Enviando...',
      send: 'Enviar mensaje',
    },
    en: {
      sent_ok: 'Your message was sent to support. We will get back to you soon.',
      send_error: 'Failed to send',
      back: 'Back',
      title: 'Support',
      app_policies: 'App policies',
      abandon_title: 'Match abandonment (3 hours before kickoff)',
      abandon_desc: 'If a player leaves a match within 3 hours before kickoff, they are blocked from rejoining that same match.',
      intro: 'Had an issue in a match or need help with the app? Write to us and we will solve it.',
      subject: 'Subject',
      subject_ph: 'e.g. Issue with a player, payment error',
      message: 'Message',
      message_ph: 'Explain the situation in detail...',
      sending: 'Sending...',
      send: 'Send message',
    },
    pt: {
      sent_ok: 'Sua mensagem foi enviada para o suporte. Responderemos em breve.',
      send_error: 'Erro ao enviar',
      back: 'Voltar',
      title: 'Suporte',
      app_policies: 'Politicas do app',
      abandon_title: 'Abandono da partida (3 horas antes)',
      abandon_desc: 'Se um jogador sair da partida dentro de 3 horas antes do horario, fica bloqueado para entrar novamente nessa mesma partida.',
      intro: 'Teve algum problema em uma partida ou precisa de ajuda com o app? Escreva para nos e resolvemos.',
      subject: 'Assunto',
      subject_ph: 'Ex. Problema com jogador, erro de pagamento',
      message: 'Mensagem',
      message_ph: 'Explique a situacao em detalhe...',
      sending: 'Enviando...',
      send: 'Enviar mensagem',
    },
  }[language];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;

    try {
      setLoading(true);
      await supportAPI.createTicket(subject, message);
      alert(i18n.sent_ok);
      navigate('/');
    } catch (err) {
      alert(err.message || i18n.send_error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <button className="btn btn-sm btn-secondary" onClick={() => navigate(-1)}>{i18n.back}</button>
        <h1 className="page-title" style={{ marginTop: '0.5rem' }}>{i18n.title}</h1>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0, marginBottom: '0.75rem' }}>{i18n.app_policies}</h3>
        <div className="card" style={{ marginBottom: '1rem', borderColor: openPolicy === 'abandon' ? 'var(--color-primary)' : 'var(--color-border)' }}>
          <strong>{i18n.abandon_title}</strong>
          <p style={{ marginTop: '0.5rem' }}>
            {i18n.abandon_desc}
          </p>
        </div>

        <p>{i18n.intro}</p>
        
        <form onSubmit={handleSubmit} style={{ marginTop: '1rem' }}>
          <div className="form-group">
            <label>{i18n.subject}</label>
            <input 
              required
              type="text" 
              className="form-input" 
              value={subject} 
              onChange={e => setSubject(e.target.value)}
              placeholder={i18n.subject_ph}
            />
          </div>

          <div className="form-group">
            <label>{i18n.message}</label>
            <textarea 
              required
              className="form-input" 
              rows="5"
              value={message} 
              onChange={e => setMessage(e.target.value)}
              placeholder={i18n.message_ph}
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? i18n.sending : i18n.send}
          </button>
        </form>
      </div>
    </div>
  );
}
