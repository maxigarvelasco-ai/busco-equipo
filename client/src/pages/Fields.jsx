import { useState, useEffect } from 'react';
import { fieldsAPI } from '../services/api';

export default function Fields() {
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFields();
  }, []);

  const loadFields = async () => {
    try {
      setLoading(true);
      const data = await fieldsAPI.getAll();
      setFields(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading-spinner"><div className="spinner"></div></div>;

  return (
    <div className="page-content" style={{ paddingBottom: '80px' }}>
      <div className="page-header">
        <h1 className="page-title">Canchas Disponibles</h1>
      </div>

      {fields.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🏟️</div>
          <div className="empty-state-title">No hay canchas registradas</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {fields.map(f => (
             <div key={f.id} className={`card match-card animate-in ${f.is_featured ? 'card-featured' : ''}`}>
               {f.is_featured && (
                 <div className="badge badge-featured" style={{ marginBottom: '0.75rem' }}>
                   ⭐ CANCHA DESTACADA
                 </div>
               )}
               <div className="match-card-header">
                 <div className="match-type">
                   <span className="match-type-icon">🏟️</span>
                   <span className="match-type-label" style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{f.name}</span>
                 </div>
               </div>
               <div className="match-info">
                 <div className="match-info-row">
                   <span className="info-icon">📍</span>
                   <span>{f.address}, {f.city}</span>
                 </div>
                 {f.phone && (
                   <div className="match-info-row">
                     <span className="info-icon">📞</span>
                     <span>{f.phone}</span>
                   </div>
                 )}
               </div>
               <div className="match-card-footer" style={{ marginTop: '1rem' }}>
                 <button className="btn btn-primary" style={{ width: '100%' }}>Ver Horarios</button>
               </div>
             </div>
          ))}
        </div>
      )}
    </div>
  );
}
