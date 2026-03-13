import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { matchesAPI } from '../services/api';

export default function CreateMatch() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    football_type: '5',
    city: '',
    address: '',
    latitude: null,
    longitude: null,
    zone: '',
    match_date: new Date().toISOString().split('T')[0],
    match_time: '21:00',
    max_players: '10',
    description: '',
  });

  const addressInputRef = useRef(null);
  const autocompleteRef = useRef(null);

  useEffect(() => {
    // Initialize Google Places Autocomplete
    if (window.google && window.google.maps && window.google.maps.places && addressInputRef.current) {
      autocompleteRef.current = new window.google.maps.places.Autocomplete(addressInputRef.current, {
        fields: ['formatted_address', 'geometry', 'address_components'],
        types: ['establishment', 'geocode'],
      });

      autocompleteRef.current.addListener('place_changed', handlePlaceSelect);
    }
  }, []);

  const handlePlaceSelect = () => {
    const place = autocompleteRef.current.getPlace();

    if (!place.geometry || !place.geometry.location) {
      setError('Por favor seleccioná una ubicación válida de la lista.');
      return;
    }

    let city = form.city; // keep existing city if we can't find one
    if (place.address_components) {
      const cityComponent = place.address_components.find(
        (c) => c.types.includes('locality') || c.types.includes('administrative_area_level_2')
      );
      if (cityComponent) {
        city = cityComponent.long_name;
      }
    }

    setForm((prev) => ({
      ...prev,
      address: place.formatted_address,
      city: city || prev.city,
      zone: city || prev.zone,
      latitude: place.geometry.location.lat(),
      longitude: place.geometry.location.lng(),
    }));
    
    // Also reflect the selected formatted address in the input manually 
    // to keep it in sync with state
    if (addressInputRef.current) {
       addressInputRef.current.value = place.formatted_address;
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => {
      const updated = { ...prev, [name]: value };
      if (name === 'football_type') {
        updated.max_players = value === '5' ? '10' : value === '7' ? '14' : '22';
      }
      return updated;
    });
  };

  const handleAddressInputChange = (e) => {
     // If user types manually but doesn't select, we clear coordinates
     setForm(prev => ({
       ...prev,
       address: e.target.value,
       latitude: null,
       longitude: null
     }));
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.city.trim()) {
      setError('Seleccioná una ciudad');
      return;
    }
    
    // We optionally enforce them to click an autocomplete item to ensure coords
    if (!form.latitude || !form.longitude) {
       setError('Por favor buscá y seleccioná una dirección real de la lista desplegable.');
       // return; // Uncomment to strictly require valid geocoded selection
    }

    setLoading(true);
    try {
      await matchesAPI.create({
        football_type: parseInt(form.football_type),
        city: form.city,
        address: form.address || null,
        latitude: form.latitude,
        longitude: form.longitude,
        zone: form.zone || form.city,
        match_date: form.match_date,
        match_time: form.match_time,
        max_players: parseInt(form.max_players),
        description: form.description || null,
      });
      navigate('/');
    } catch (err) {
      setError(err.message || 'Error al crear el partido');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <h1 className="page-title">Crear Partido</h1>
      </div>

      {error && <div className="form-error">{error}</div>}

      <form onSubmit={handleSubmit}>
        {/* Football type */}
        <div className="form-group">
          <label className="form-label">Tipo de Fútbol</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {['5', '7', '11'].map((type) => (
              <button
                key={type}
                type="button"
                className={`btn ${
                  form.football_type === type ? 'btn-primary' : 'btn-secondary'
                }`}
                style={{ flex: 1 }}
                onClick={() =>
                  handleChange({ target: { name: 'football_type', value: type } })
                }
              >
                ⚽ Fútbol {type}
              </button>
            ))}
          </div>
        </div>

        {/* City */}
        <div className="form-group">
          <label className="form-label">Ciudad</label>
          <input
            type="text"
            className="form-input"
            name="city"
            placeholder="Ej: Rosario, Buenos Aires..."
            value={form.city}
            onChange={handleChange}
            required
          />
        </div>

        {/* Address with Google Maps Autocomplete */}
        <div className="form-group">
          <label className="form-label">
            Dirección / Cancha
            {form.latitude && form.longitude && (
              <span
                style={{
                  marginLeft: '0.5rem',
                  color: 'var(--color-primary)',
                  fontSize: 'var(--font-size-xs)',
                }}
              >
                ✓ Ubicación seleccionada
              </span>
            )}
          </label>
          <input
            type="text"
            className="form-input"
            placeholder="Buscá la dirección o nombre de la cancha..."
            ref={addressInputRef}
            onChange={handleAddressInputChange}
            defaultValue={form.address}
          />
          {form.latitude && form.longitude && (
            <div
              style={{
                marginTop: '0.5rem',
                padding: '0.5rem 0.75rem',
                background: 'rgba(34, 197, 94, 0.1)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-size-xs)',
                color: 'var(--color-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <span>📌</span>
              <span>
                Coordenadas: {form.latitude.toFixed(5)}, {form.longitude.toFixed(5)}
              </span>
            </div>
          )}
        </div>

        {/* Date & Time */}
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Fecha</label>
            <input
              type="date"
              className="form-input"
              name="match_date"
              value={form.match_date}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Hora</label>
            <input
              type="time"
              className="form-input"
              name="match_time"
              value={form.match_time}
              onChange={handleChange}
              required
            />
          </div>
        </div>

        {/* Max players */}
        <div className="form-group">
          <label className="form-label">Jugadores máximos</label>
          <input
            type="number"
            className="form-input"
            name="max_players"
            min="2"
            max="30"
            value={form.max_players}
            onChange={handleChange}
            required
          />
        </div>

        {/* Description */}
        <div className="form-group">
          <label className="form-label">Descripción (opcional)</label>
          <textarea
            className="form-textarea"
            name="description"
            placeholder="Ejemplo: Traer pechera oscura, nivel intermedio..."
            value={form.description}
            onChange={handleChange}
          />
        </div>

        <button
          type="submit"
          className="btn btn-primary btn-lg btn-full"
          disabled={loading}
        >
          {loading ? 'Creando...' : '⚽ Crear Partido'}
        </button>
      </form>

      {/* Minor fix for Google Autocomplete in mobile views */}
      <style>{`.pac-container { z-index: 10000 !important; background-color: var(--color-bg-elevated) !important; color: var(--color-text) !important; border: 1px solid var(--color-border) !important;} .pac-item { color: var(--color-text-secondary) !important; border-top: 1px solid var(--color-border) !important;} .pac-item-query { color: var(--color-text) !important; }`}</style>
    </div>
  );
}
