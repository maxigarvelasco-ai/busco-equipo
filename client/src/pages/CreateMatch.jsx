import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { matchesAPI, tournamentsAPI } from '../services/api';

export default function CreateMatch() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [requestType, setRequestType] = useState('casual_match');
  const [footballType, setFootballType] = useState('5');
  const [matchForm, setMatchForm] = useState({
    venue: '',
    date: new Date().toISOString().split('T')[0],
    time: '21:00',
    needed_players: '3',
    description: '',
  });
  const [tournamentForm, setTournamentForm] = useState({
    name: '',
    venue: '',
    start_date: new Date().toISOString().split('T')[0],
    needed_players: '2',
    description: '',
  });
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);
  const currentAddressQuery = requestType === 'casual_match' ? matchForm.venue : tournamentForm.venue;

  const getPlacesAutocompleteService = () => {
    if (!window.google?.maps?.places?.AutocompleteService) return null;
    if (!window.__buscoEquipoPlacesService) {
      window.__buscoEquipoPlacesService = new window.google.maps.places.AutocompleteService();
    }
    return window.__buscoEquipoPlacesService;
  };

  useEffect(() => {
    const query = (currentAddressQuery || '').trim();
    if (query.length < 1) {
      setAddressSuggestions([]);
      return;
    }

    let cancelled = false;
    const timeoutId = setTimeout(async () => {
      const service = getPlacesAutocompleteService();
      if (!service) {
        if (!cancelled) setAddressSuggestions([]);
        return;
      }

      const predictions = await new Promise((resolve) => {
        service.getPlacePredictions(
          {
            input: query,
            types: ['address'],
            componentRestrictions: { country: 'ar' },
            language: 'es',
          },
          (result, status) => {
            const ok = status === window.google.maps.places.PlacesServiceStatus.OK;
            resolve(ok ? (result || []) : []);
          }
        );
      });

      if (cancelled) return;
      const normalizedQuery = query.toLowerCase();
      const labels = predictions.map((p) => p.description).filter(Boolean);
      const startsWith = labels.filter((label) => label.toLowerCase().startsWith(normalizedQuery));
      const fallback = labels.filter((label) => label.toLowerCase().includes(normalizedQuery));
      const names = Array.from(new Set([...(startsWith.length ? startsWith : fallback)])).slice(0, 8);

      setAddressSuggestions(names);
      setShowAddressSuggestions(true);
    }, 260);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [currentAddressQuery]);

  const extractCityFromAddress = (address) => {
    const parts = (address || '')
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    return parts.length >= 2 ? parts[1] : '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    setLoading(true);
    try {
      if (requestType === 'casual_match') {
        if (!matchForm.venue.trim()) {
          throw new Error('Completá la dirección');
        }
        const inferredCity = extractCityFromAddress(matchForm.venue);
        if (!inferredCity) {
          throw new Error('Seleccioná una dirección que incluya ciudad');
        }
        await matchesAPI.create({
          football_type: parseInt(footballType),
          title: `Partido F${footballType}`,
          city: inferredCity,
          address: matchForm.venue,
          zone: inferredCity,
          match_date: matchForm.date,
          match_time: matchForm.time,
          max_players: Math.max(parseInt(matchForm.needed_players || '1') + 1, 2),
          match_kind: 'recreativo',
          visibility: 'public',
          requires_approval: true,
          allow_waitlist: true,
          price_per_player: 0,
          description: matchForm.description || null,
        });
      } else {
        if (!tournamentForm.name.trim()) {
          throw new Error('Completá el nombre del torneo');
        }
        await tournamentsAPI.create({
          name: tournamentForm.name,
          football_type: parseInt(footballType),
          start_date: tournamentForm.start_date,
          max_teams: 2,
          entry_price: 0,
          city: extractCityFromAddress(tournamentForm.venue) || null,
          venue_name: tournamentForm.venue || null,
          needed_players: parseInt(tournamentForm.needed_players || '1'),
          description: tournamentForm.description || null,
        });
      }
      navigate('/');
    } catch (err) {
      setError(err.message || 'Error al crear la solicitud');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <h1 className="page-title">Buscar jugadores</h1>
      </div>

      {error && <div className="form-error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label">Paso 1: Para que buscas jugadores?</label>
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            <label className="card" style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', padding: '0.7rem' }}>
              <input type="radio" name="request_type" checked={requestType === 'casual_match'} onChange={() => setRequestType('casual_match')} />
              Partido casual
            </label>
            <label className="card" style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', padding: '0.7rem' }}>
              <input type="radio" name="request_type" checked={requestType === 'tournament_request'} onChange={() => setRequestType('tournament_request')} />
              Completar equipo para torneo
            </label>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Paso 2: Tipo de futbol</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {['5', '7', '11'].map((type) => (
              <button
                key={type}
                type="button"
                className={`btn ${footballType === type ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1 }}
                onClick={() => setFootballType(type)}
              >
                F{type}
              </button>
            ))}
          </div>
        </div>

        {requestType === 'casual_match' ? (
          <div style={{ display: 'grid', gap: '0.6rem' }}>
            <div className="form-group">
              <label className="form-label">Dirección</label>
              <input
                className="form-input"
                value={matchForm.venue}
                onFocus={() => setShowAddressSuggestions(true)}
                onBlur={() => setTimeout(() => setShowAddressSuggestions(false), 120)}
                onChange={(e) => setMatchForm((p) => ({ ...p, venue: e.target.value }))}
                required
              />
              {showAddressSuggestions && addressSuggestions.length > 0 && (
                <div className="card" style={{ marginTop: '0.35rem', padding: '0.25rem', maxHeight: 180, overflowY: 'auto' }}>
                  {addressSuggestions.map((address) => (
                    <button
                      key={address}
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ width: '100%', justifyContent: 'flex-start', marginBottom: '0.25rem' }}
                      onMouseDown={() => setMatchForm((p) => ({ ...p, venue: address }))}
                    >
                      {address}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Fecha</label>
                <input type="date" className="form-input" value={matchForm.date} onChange={(e) => setMatchForm((p) => ({ ...p, date: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Hora</label>
                <input type="time" className="form-input" value={matchForm.time} onChange={(e) => setMatchForm((p) => ({ ...p, time: e.target.value }))} required />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Jugadores necesarios</label>
              <input type="number" className="form-input" min="1" max="30" value={matchForm.needed_players} onChange={(e) => setMatchForm((p) => ({ ...p, needed_players: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label className="form-label">Descripcion</label>
              <textarea className="form-textarea" value={matchForm.description} onChange={(e) => setMatchForm((p) => ({ ...p, description: e.target.value }))} />
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '0.6rem' }}>
            <div className="form-group">
              <label className="form-label">Nombre del torneo</label>
              <input className="form-input" value={tournamentForm.name} onChange={(e) => setTournamentForm((p) => ({ ...p, name: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label className="form-label">Dirección o complejo</label>
              <input
                className="form-input"
                value={tournamentForm.venue}
                onFocus={() => setShowAddressSuggestions(true)}
                onBlur={() => setTimeout(() => setShowAddressSuggestions(false), 120)}
                onChange={(e) => setTournamentForm((p) => ({ ...p, venue: e.target.value }))}
              />
              {showAddressSuggestions && addressSuggestions.length > 0 && (
                <div className="card" style={{ marginTop: '0.35rem', padding: '0.25rem', maxHeight: 180, overflowY: 'auto' }}>
                  {addressSuggestions.map((address) => (
                    <button
                      key={address}
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ width: '100%', justifyContent: 'flex-start', marginBottom: '0.25rem' }}
                      onMouseDown={() => setTournamentForm((p) => ({ ...p, venue: address }))}
                    >
                      {address}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Fecha de inicio</label>
                <input type="date" className="form-input" value={tournamentForm.start_date} onChange={(e) => setTournamentForm((p) => ({ ...p, start_date: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Jugadores que faltan</label>
                <input type="number" className="form-input" min="1" max="30" value={tournamentForm.needed_players} onChange={(e) => setTournamentForm((p) => ({ ...p, needed_players: e.target.value }))} required />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Descripcion</label>
              <textarea className="form-textarea" value={tournamentForm.description} onChange={(e) => setTournamentForm((p) => ({ ...p, description: e.target.value }))} />
            </div>
          </div>
        )}

        <button type="submit" className="btn btn-primary btn-lg btn-full" disabled={loading}>
          {loading ? 'Publicando...' : 'Publicar solicitud'}
        </button>

      </form>
    </div>
  );
}
