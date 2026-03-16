import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { profilesAPI } from '../services/api';

export default function UserProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  async function loadData() {
    try {
      setLoading(true);
      const [p, convo] = await Promise.all([
        profilesAPI.get(id),
        profilesAPI.getConversation(id).catch(() => []),
      ]);
      setProfile(p);
      setMessages(convo || []);
    } catch (err) {
      console.error('Error loading user profile:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddContact() {
    try {
      await profilesAPI.addContact(id);
      alert('Contacto agregado');
    } catch (err) {
      console.error('Error adding contact:', err);
      alert('No se pudo agregar contacto');
    }
  }

  async function handleSendMessage(e) {
    e.preventDefault();
    const text = newMessage.trim();
    if (!text) return;
    try {
      await profilesAPI.sendDirectMessage(id, text);
      setNewMessage('');
      await loadData();
    } catch (err) {
      console.error('Error sending direct message:', err);
      alert('No se pudo enviar el mensaje');
    }
  }

  if (loading) return <div className="loading-spinner"><div className="spinner"></div></div>;
  if (!profile) return <div className="page-content">Perfil no encontrado</div>;

  const initial = profile.name ? profile.name[0].toUpperCase() : '?';

  return (
    <div className="page-content" style={{ paddingBottom: '80px' }}>
      <div className="page-header" style={{ marginBottom: '1rem' }}>
        <button className="btn btn-sm btn-secondary" onClick={() => navigate(-1)}>Volver</button>
        <h1 className="page-title" style={{ marginTop: '0.5rem' }}>Perfil</h1>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt={profile.name} style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#ddd', display: 'grid', placeItems: 'center', fontWeight: 700 }}>{initial}</div>
          )}
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{profile.name || 'Sin nombre'}</div>
            <div style={{ color: '#666', fontSize: '0.9rem' }}>ID: {profile.id}</div>
          </div>
        </div>

        {user?.id !== profile.id && (
          <div style={{ marginTop: '0.75rem' }}>
            <button className="btn btn-secondary" onClick={handleAddContact}>Agregar contacto</button>
          </div>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Mensajes</h3>
        <div style={{ maxHeight: 320, overflowY: 'auto', background: '#f8f8f8', padding: '0.75rem', borderRadius: 8, marginBottom: '0.75rem' }}>
          {messages.length === 0 ? (
            <p style={{ color: '#666', margin: 0 }}>No hay mensajes todavía.</p>
          ) : (
            messages.map((m) => {
              const mine = m.from_user_id === user?.id;
              return (
                <div key={m.id} style={{ textAlign: mine ? 'right' : 'left', marginBottom: '0.5rem' }}>
                  <span style={{ display: 'inline-block', padding: '0.5rem 0.75rem', borderRadius: 12, background: mine ? 'var(--color-primary)' : '#e5e7eb', color: mine ? '#fff' : '#111' }}>
                    {m.message}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {user?.id !== profile.id && (
          <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              className="form-input"
              style={{ flex: 1 }}
              placeholder="Escribir mensaje..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
            />
            <button className="btn btn-primary" type="submit">Enviar</button>
          </form>
        )}
      </div>
    </div>
  );
}
