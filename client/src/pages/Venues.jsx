import { useState, useEffect } from 'react';
import { venuesAPI } from '../services/api';

const ZONES = ['Todas', 'Centro', 'Pichincha', 'Fisherton', 'Echesortu', 'Alberdi', 'Arroyito', 'Macrocentro'];
const SUGGESTED_VENUES = [
  { id: 's1', name: 'Tifosi Futbol', zone: 'Pichincha', city: 'Rosario', football: 'F5/F7', amenities: ['iluminacion', 'vestuarios', 'buffet'] },
  { id: 's2', name: 'La Nueva Cancha', zone: 'Fisherton', city: 'Rosario', football: 'F7/F11', amenities: ['estacionamiento', 'duchas', 'bar'] },
  { id: 's3', name: 'Complejo Sur', zone: 'Echesortu', city: 'Rosario', football: 'F5', amenities: ['techado', 'iluminacion', 'kiosco'] },
];

export default function Venues() {
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedZone, setSelectedZone] = useState('Todas');

  useEffect(() => {
    async function fetchVenues() {
      try {
        setLoading(true);
        const filters = {};
        if (selectedZone !== 'Todas') filters.zone = selectedZone;
        const data = await venuesAPI.getAll(filters);
        setVenues(data);
      } catch {
        setVenues([]);
      } finally {
        setLoading(false);
      }
    }
    fetchVenues();
  }, [selectedZone]);

  return (
    <div className="page-content">
      <div className="page-header">
        <h1 className="page-title">Canchas</h1>
      </div>

      <div className="area-filter">
        {ZONES.map(zone => (
          <button
            key={zone}
            className={`area-pill ${selectedZone === zone ? 'active' : ''}`}
            onClick={() => setSelectedZone(zone)}
          >
            {zone}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'grid', gap: '0.8rem' }}>
          <div className="skeleton-card"></div>
          <div className="skeleton-card"></div>
        </div>
      ) : venues.length === 0 ? (
        <div>
          <div className="empty-state" style={{ paddingBottom: '1rem' }}>
            <div className="empty-state-icon">🏟️</div>
            <div className="empty-state-title">No hay canchas cargadas en esta zona</div>
            <p style={{ color: 'var(--color-text-muted)' }}>Mientras tanto, te sugerimos estas opciones populares</p>
          </div>
          <div style={{ display: 'grid', gap: '0.7rem' }}>
            {SUGGESTED_VENUES.map((v) => (
              <div key={v.id} className="card venue-card">
                <div className="venue-name">🏟️ {v.name}</div>
                <div className="match-info">
                  <div className="match-info-row"><span className="info-icon">📍</span><span>{v.zone} - {v.city}</span></div>
                  <div className="match-info-row"><span className="info-icon">⚽</span><span>{v.football}</span></div>
                  <div className="match-info-row"><span className="info-icon">🧰</span><span>{v.amenities.join(' · ')}</span></div>
                </div>
                <div style={{ marginTop: '0.8rem', display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                  <button className="btn btn-secondary btn-sm">Ver horarios</button>
                  <button className="btn btn-primary btn-sm">Reservar</button>
                  <button className="btn btn-secondary btn-sm">Ver torneos</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        venues.map(venue => (
          <div key={venue.id} className="card venue-card animate-in">
            <div>
              <div className="venue-name">🏟️ {venue.name}</div>
              <div className="match-info">
                <div className="match-info-row">
                  <span className="info-icon">📍</span>
                  <span>{venue.address || venue.zone} — <strong>{venue.zone}</strong></span>
                </div>
                {venue.rating != null && (
                  <div className="match-info-row">
                    <span className="info-icon">⭐</span>
                    <span>{Number(venue.rating).toFixed(1)} / 5</span>
                  </div>
                )}
                {venue.is_verified && (
                  <div className="match-info-row">
                    <span className="info-icon">✅</span>
                    <span>Cancha verificada</span>
                  </div>
                )}
                {venue.phone && (
                  <div className="match-info-row">
                    <span className="info-icon">📞</span>
                    <span>{venue.phone}</span>
                  </div>
                )}
                {venue.amenities && venue.amenities.length > 0 && (
                  <div className="match-info-row">
                    <span className="info-icon">🧰</span>
                    <span>{venue.amenities.join(' · ')}</span>
                  </div>
                )}
              </div>

              {/* Available slots */}
              {venue.venue_slots && venue.venue_slots.length > 0 && (
                <div style={{ marginTop: '0.75rem' }}>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginBottom: '0.5rem', fontWeight: 600 }}>
                    Horarios disponibles:
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    {venue.venue_slots.map(slot => (
                      <span key={slot.id} className="badge badge-type" style={{ fontSize: '0.7rem' }}>
                        F{slot.football_type} · {slot.slot_time?.slice(0, 5)} {slot.price ? `$${slot.price}` : ''}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-secondary btn-sm">Ver horarios</button>
              <button className="btn btn-primary btn-sm">Reservar</button>
              <button className="btn btn-secondary btn-sm">Ver torneos</button>
              {venue.phone && (
                <a href={`tel:${venue.phone}`} className="btn btn-secondary btn-sm">Llamar</a>
              )}
              {venue.whatsapp && (
                <a href={`https://wa.me/${venue.whatsapp.replace(/\D/g, '')}`} className="btn btn-secondary btn-sm" target="_blank" rel="noreferrer">
                  WhatsApp
                </a>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
