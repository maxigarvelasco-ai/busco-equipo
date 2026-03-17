import { useState, useEffect } from 'react';
import { venuesAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
const SUGGESTED_VENUES = [
  { id: 's1', name: 'Tifosi Futbol', zone: 'Pichincha', city: 'Rosario', football: 'F5/F7', amenities: ['iluminacion', 'vestuarios', 'buffet'] },
  { id: 's2', name: 'La Nueva Cancha', zone: 'Fisherton', city: 'Rosario', football: 'F7/F11', amenities: ['estacionamiento', 'duchas', 'bar'] },
  { id: 's3', name: 'Complejo Sur', zone: 'Echesortu', city: 'Rosario', football: 'F5', amenities: ['techado', 'iluminacion', 'kiosco'] },
];

export default function Venues() {
  const { user, profile } = useAuth();
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: '',
    address: '',
    city: '',
    football_types: [],
    services: [],
  });
  const [citySuggestions, setCitySuggestions] = useState([]);
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);

  const getPlacesAutocompleteService = () => {
    if (!window.google?.maps?.places?.AutocompleteService) return null;
    if (!window.__buscoEquipoPlacesService) {
      window.__buscoEquipoPlacesService = new window.google.maps.places.AutocompleteService();
    }
    return window.__buscoEquipoPlacesService;
  };

  const canManageVenues = user && profile?.profile_type === 'venue_member';

  useEffect(() => {
    async function fetchVenues() {
      try {
        setLoading(true);
        const data = await venuesAPI.getAll({});
        setVenues(data);
      } catch {
        setVenues([]);
      } finally {
        setLoading(false);
      }
    }
    fetchVenues();
  }, []);

  const toggleInArray = (key, value) => {
    setForm((prev) => {
      const arr = prev[key] || [];
      return {
        ...prev,
        [key]: arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value],
      };
    });
  };

  const handleCreateVenue = async (e) => {
    e.preventDefault();
    try {
      setCreating(true);
      await venuesAPI.create(form);
      setForm({ name: '', address: '', city: '', football_types: [], services: [] });
      setShowCreate(false);
      const data = await venuesAPI.getAll({});
      setVenues(data);
    } catch {
      // keep minimal flow
    } finally {
      setCreating(false);
    }
  };

  useEffect(() => {
    const query = (form.city || '').trim();
    if (query.length < 2) {
      setCitySuggestions([]);
      return;
    }

    let cancelled = false;
    const timeoutId = setTimeout(async () => {
      const service = getPlacesAutocompleteService();
      if (!service) {
        if (!cancelled) setCitySuggestions([]);
        return;
      }

      const predictions = await new Promise((resolve) => {
        service.getPlacePredictions(
          {
            input: query,
            types: ['(cities)'],
            componentRestrictions: { country: 'ar' },
          },
          (result, status) => {
            const ok = status === window.google.maps.places.PlacesServiceStatus.OK;
            resolve(ok ? (result || []) : []);
          }
        );
      });

      if (cancelled) return;
      const normalizedQuery = query.toLowerCase();
      const labels = predictions
        .map((p) => p.description)
        .filter(Boolean);

      const startsWith = labels.filter((label) => label.toLowerCase().startsWith(normalizedQuery));
      const fallback = labels.filter((label) => label.toLowerCase().includes(normalizedQuery));
      const names = Array.from(new Set([...(startsWith.length ? startsWith : fallback)])).slice(0, 8);

      setCitySuggestions(names);
      setShowCitySuggestions(true);
    }, 260);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [form.city]);

  return (
    <div className="page-content">
      <div className="page-header">
        <h1 className="page-title">Canchas</h1>
        {canManageVenues && (
          <button className="btn btn-primary btn-sm" onClick={() => setShowCreate((v) => !v)}>
            {showCreate ? 'Cerrar' : 'Agregar'}
          </button>
        )}
      </div>

      {user && !canManageVenues && (
        <div className="card" style={{ marginBottom: '0.7rem', padding: '0.75rem', color: 'var(--color-text-secondary)' }}>
          Solo perfiles "Miembro de canchas" pueden agregar canchas.
        </div>
      )}

      {showCreate && (
        <form className="card" onSubmit={handleCreateVenue} style={{ marginBottom: '0.7rem' }}>
          <div className="form-group">
            <label className="form-label">Nombre</label>
            <input className="form-input" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required />
          </div>
          <div className="form-group">
            <label className="form-label">Direccion</label>
            <input className="form-input" value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} required />
          </div>
          <div className="form-group">
            <label className="form-label">Ciudad</label>
            <input
              className="form-input"
              value={form.city}
              onFocus={() => setShowCitySuggestions(true)}
              onBlur={() => setTimeout(() => setShowCitySuggestions(false), 120)}
              onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
              required
            />
            {showCitySuggestions && citySuggestions.length > 0 && (
              <div className="card" style={{ marginTop: '0.35rem', padding: '0.25rem', maxHeight: 180, overflowY: 'auto' }}>
                {citySuggestions.map((city) => (
                  <button
                    key={city}
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ width: '100%', justifyContent: 'flex-start', marginBottom: '0.25rem' }}
                    onMouseDown={() => setForm((p) => ({ ...p, city }))}
                  >
                    {city}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Tipos de futbol</label>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {['F5', 'F7', 'F11'].map((ft) => (
                <button key={ft} type="button" className={`btn btn-sm ${form.football_types.includes(ft) ? 'btn-primary' : 'btn-secondary'}`} onClick={() => toggleInArray('football_types', ft)}>
                  {ft}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Servicios</label>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {['buffet', 'vestuarios', 'iluminacion', 'estacionamiento', 'torneos', 'entrenamiento funcional'].map((service) => (
                <button key={service} type="button" className={`btn btn-sm ${form.services.includes(service) ? 'btn-primary' : 'btn-secondary'}`} onClick={() => toggleInArray('services', service)}>
                  {service}
                </button>
              ))}
            </div>
          </div>

          <button className="btn btn-primary btn-full" type="submit" disabled={creating}>
            {creating ? 'Guardando...' : 'Guardar cancha'}
          </button>

        </form>
      )}

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
                  <span>{venue.address || venue.zone} - <strong>{venue.city || venue.zone}</strong></span>
                </div>
                {(venue.football_types && venue.football_types.length > 0) && (
                  <div className="match-info-row">
                    <span className="info-icon">⚽</span>
                    <span>{venue.football_types.join(' ')}</span>
                  </div>
                )}
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
                {(venue.services && venue.services.length > 0) && (
                  <div className="match-info-row">
                    <span className="info-icon">🧰</span>
                    <span>{venue.services.join(' · ')}</span>
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
                      <span key={slot.id} className={`badge ${slot.is_booked || slot.status === 'booked' ? 'badge-full' : 'badge-type'}`} style={{ fontSize: '0.7rem' }}>
                        {slot.slot_time?.slice(0, 5)} {slot.is_booked || slot.status === 'booked' ? 'reservado' : 'disponible'}
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
