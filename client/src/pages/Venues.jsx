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
    inferred_city: '',
    football_types: [],
    services: [],
  });
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);
  const [mapsReady, setMapsReady] = useState(false);
  const [detectedLocation, setDetectedLocation] = useState('');
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [detectedCoords, setDetectedCoords] = useState(null);

  const getPlacesAutocompleteService = () => {
    if (!window.google?.maps?.places?.AutocompleteService) return null;
    if (!window.__buscoEquipoPlacesService) {
      window.__buscoEquipoPlacesService = new window.google.maps.places.AutocompleteService();
    }
    return window.__buscoEquipoPlacesService;
  };

  const canUsePlacesNew = () => !window.__buscoEquipoDisablePlacesNew;

  const shouldDisablePlacesNew = (err) => {
    const msg = String(err?.message || '').toLowerCase();
    const status = String(err?.status || '').toLowerCase();
    const code = String(err?.code || '').toLowerCase();
    return (
      msg.includes('403')
      || msg.includes('forbidden')
      || msg.includes('permission')
      || msg.includes('api key')
      || msg.includes('not authorized')
      || status.includes('permission_denied')
      || code === '403'
    );
  };

  const fetchAddressSuggestions = async (query) => {
    if (!window.google?.maps) return [];

    try {
      if (canUsePlacesNew()) {
        const placesLib = await window.google.maps.importLibrary('places');
        const Suggestion = placesLib?.AutocompleteSuggestion;
        if (Suggestion?.fetchAutocompleteSuggestions) {
          const response = await Suggestion.fetchAutocompleteSuggestions({
            input: query,
            language: 'es',
          });
          const raw = response?.suggestions || [];
          const mapped = raw.map((s) => {
            const p = s?.placePrediction;
            const label =
              p?.text?.text
              || p?.structuredFormat?.mainText?.text
              || p?.mainText?.text
              || '';
            const secondary =
              p?.structuredFormat?.secondaryText?.text
              || p?.secondaryText?.text
              || '';
            const full = secondary ? `${label}, ${secondary}` : label;
            const city = secondary ? secondary.split(',')[0].trim() : '';
            return {
              label: full,
              city,
            };
          }).filter((x) => x.label);

          if (mapped.length > 0) return mapped;
        }
      }
    } catch (err) {
      if (shouldDisablePlacesNew(err)) {
        window.__buscoEquipoDisablePlacesNew = true;
      }
    }

    const service = getPlacesAutocompleteService();
    if (!service) return [];
    const legacy = await getPredictions(service, {
      input: query,
      types: ['geocode'],
      language: 'es',
    });
    return legacy.map((p) => ({
      label: p.description,
      city: inferCityFromPrediction(p),
    }));
  };

  const inferCityFromPrediction = (prediction) => {
    const terms = prediction?.terms || [];
    if (terms.length >= 2) return terms[1]?.value || '';
    const secondary = prediction?.structured_formatting?.secondary_text || '';
    return secondary ? secondary.split(',')[0].trim() : '';
  };

  const inferCityFromText = (address) => {
    const parts = String(address || '')
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    return parts.length >= 2 ? parts[1] : '';
  };

  const detectMyLocation = async () => {
    if (!navigator.geolocation) return;
    setDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setDetectedCoords({ lat: coords.latitude, lng: coords.longitude });
        setDetectedLocation('GPS detectado para priorizar resultados');
        setDetectingLocation(false);
      },
      () => {
        setDetectingLocation(false);
      },
      {
        enableHighAccuracy: false,
        timeout: 8000,
        maximumAge: 600000,
      }
    );
  };

  const getPredictions = (service, request) => new Promise((resolve) => {
    service.getPlacePredictions(request, (result, status) => {
      const ok = status === window.google.maps.places.PlacesServiceStatus.OK;
      resolve(ok ? (result || []) : []);
    });
  });

  const canManageVenues = user && profile?.profile_type === 'venue_member';

  useEffect(() => {
    const id = setInterval(() => {
      if (window.google?.maps?.places?.AutocompleteService) {
        setMapsReady(true);
        clearInterval(id);
      }
    }, 250);
    return () => clearInterval(id);
  }, []);

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
    detectMyLocation();
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
      const inferredCity = form.inferred_city || inferCityFromText(form.address) || null;
      if (!inferredCity) {
        throw new Error('Seleccioná una dirección que incluya ciudad');
      }
      await venuesAPI.create({ ...form, city: inferredCity, address: form.address.trim() });
      setForm({ name: '', address: '', inferred_city: '', football_types: [], services: [] });
      setShowCreate(false);
      const data = await venuesAPI.getAll({});
      setVenues(data);
    } catch {
      // keep minimal flow
    } finally {
      setCreating(false);
    }
  };

  const useDetectedLocation = () => {
    detectMyLocation();
  };

  useEffect(() => {
    const query = (form.address || '').trim();
    if (query.length < 1) {
      setAddressSuggestions([]);
      return;
    }

    let cancelled = false;
    const timeoutId = setTimeout(async () => {
      if (!window.google?.maps?.places) {
        if (!cancelled) setAddressSuggestions([]);
        return;
      }

      const geoPredictions = await fetchAddressSuggestions(query);

      if (cancelled) return;
      const normalizedQuery = query.toLowerCase();
      const startsWith = geoPredictions.filter((p) => (p.label || '').toLowerCase().startsWith(normalizedQuery));
      const fallback = geoPredictions.filter((p) => (p.label || '').toLowerCase().includes(normalizedQuery));
      const top = (startsWith.length ? startsWith : fallback).slice(0, 8);

      setAddressSuggestions(top);
      setShowAddressSuggestions(true);
    }, 260);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [form.address, mapsReady]);

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
            <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                {detectingLocation ? 'Detectando ubicación...' : (detectedLocation ? `Ubicación detectada: ${detectedLocation}` : 'Ubicación no detectada')}
              </span>
              <button type="button" className="btn btn-secondary btn-sm" onClick={useDetectedLocation} disabled={!detectedLocation}>
                Usar mi ubicación
              </button>
            </div>
            <input
              className="form-input"
              value={form.address}
              onFocus={() => setShowAddressSuggestions(true)}
              onBlur={() => setTimeout(() => setShowAddressSuggestions(false), 120)}
              onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
              required
            />
            {showAddressSuggestions && addressSuggestions.length > 0 && (
              <div className="card" style={{ marginTop: '0.35rem', padding: '0.25rem', maxHeight: 180, overflowY: 'auto' }}>
                {addressSuggestions.map((address) => (
                  <button
                    key={address.label}
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ width: '100%', justifyContent: 'flex-start', marginBottom: '0.25rem' }}
                    onMouseDown={() => setForm((p) => ({ ...p, address: address.label, inferred_city: address.city || '' }))}
                  >
                    {address.label}
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
