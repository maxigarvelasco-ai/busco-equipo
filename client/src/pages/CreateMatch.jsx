import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clubsAPI, matchesAPI, tournamentsAPI } from '../services/api';

export default function CreateMatch() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [requestType, setRequestType] = useState('casual_match');
  const [footballMode, setFootballMode] = useState('f5');
  const [matchForm, setMatchForm] = useState({
    venue: '',
    inferred_city: '',
    inferred_place_id: '',
    date: new Date().toISOString().split('T')[0],
    time: '21:00',
    needed_players: '3',
    match_gender: 'mixto',
    age_restricted: false,
    min_age: '18',
    max_age: '25',
    goalkeepers_needed: '0',
    description: '',
  });
  const [tournamentForm, setTournamentForm] = useState({
    name: '',
    venue: '',
    inferred_city: '',
    inferred_place_id: '',
    start_date: new Date().toISOString().split('T')[0],
    needed_players: '2',
    match_gender: 'mixto',
    age_restricted: false,
    min_age: '18',
    max_age: '25',
    description: '',
  });
  const [clubForm, setClubForm] = useState({
    club_name: '',
    category: '',
    position_needed: '',
    city: '',
    zone: '',
    needed_players: '1',
    description: '',
  });
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);
  const [mapsReady, setMapsReady] = useState(false);
  const [detectedLocation, setDetectedLocation] = useState('');
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [detectedCoords, setDetectedCoords] = useState(null);
  const currentAddressQuery = requestType === 'casual_match' ? matchForm.venue : tournamentForm.venue;
  const FOOTBALL_OPTIONS = [
    { key: 'futsal', label: 'Futsal', value: 5 },
    { key: 'f5', label: 'F5', value: 5 },
    { key: 'f7', label: 'F7', value: 7 },
    { key: 'f8', label: 'F8', value: 8 },
    { key: 'f11', label: 'F11', value: 11 },
  ];
  const selectedFootball = FOOTBALL_OPTIONS.find((o) => o.key === footballMode) || FOOTBALL_OPTIONS[1];
  const footballType = selectedFootball.value;

  const getPlacesAutocompleteService = () => {
    if (!window.google?.maps?.places?.AutocompleteService) return null;
    if (!window.__buscoEquipoPlacesService) {
      window.__buscoEquipoPlacesService = new window.google.maps.places.AutocompleteService();
    }
    return window.__buscoEquipoPlacesService;
  };

  const fetchAddressSuggestions = async (query) => {
    if (!window.google?.maps) return [];

    const service = getPlacesAutocompleteService();
    if (!service) return [];
    const predictions = await getPredictions(service, {
      input: query,
      types: ['geocode'],
      language: 'es',
    });
    return predictions.map((p) => ({
      label: normalizeAddressLabel(p.description),
      placeId: p.place_id,
      city: inferCityFromPrediction(p),
    }));
  };

  const inferCityFromPrediction = (prediction) => {
    const secondary = prediction?.structured_formatting?.secondary_text || '';
    if (secondary) {
      const cityFromSecondary = secondary
        .split(',')
        .map((p) => p.trim())
        .find((part) => part && !/^\d+[a-zA-Z]?$/.test(part));
      if (cityFromSecondary) return cityFromSecondary;
    }

    const terms = (prediction?.terms || []).map((t) => (t?.value || '').trim()).filter(Boolean);
    if (terms.length === 0) return '';
    const afterStreet = terms.slice(1);
    const cityCandidate = afterStreet.find((part) => !/^\d+[a-zA-Z]?$/.test(part));
    return cityCandidate || '';
  };

  const inferCityFromText = (address) => {
    const parts = String(address || '')
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    return parts.length >= 2 ? parts[1] : '';
  };

  const countryAbbrFromText = (raw) => {
    const text = String(raw || '').trim();
    if (!text) return '';
    if (/^[A-Z]{2}$/.test(text)) return text;
    const map = {
      argentina: 'AR',
      uruguay: 'UY',
      paraguay: 'PY',
      chile: 'CL',
      bolivia: 'BO',
      brasil: 'BR',
      brazil: 'BR',
      peru: 'PE',
      ecuador: 'EC',
      colombia: 'CO',
      venezuela: 'VE',
      mexico: 'MX',
      'estados unidos': 'US',
      'united states': 'US',
      espana: 'ES',
      spain: 'ES',
    };
    return map[text.toLowerCase()] || text.slice(0, 2).toUpperCase();
  };

  const normalizeAddressLabel = (value) => {
    const parts = String(value || '').split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length <= 1) return String(value || '').trim();
    const street = parts[0];
    const city = parts.length > 2 ? parts[1] : '';
    const country = countryAbbrFromText(parts[parts.length - 1]);
    return [street, city, country].filter(Boolean).join(', ');
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
    detectMyLocation();
  }, []);

  useEffect(() => {
    const query = (currentAddressQuery || '').trim();
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
      const top = (geoPredictions || []).filter((p) => p?.label).slice(0, 8);
      setAddressSuggestions(top);
      setShowAddressSuggestions(true);
    }, 260);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [currentAddressQuery, mapsReady]);

  const useDetectedLocation = () => {
    detectMyLocation();
  };

  const isAddressValid = (address) => {
    const text = String(address || '').trim();
    if (!text) return false;
    const hasStreetNumber = /\b\d{1,5}\b/.test(text);
    const looksLikeCorner = /\b(esquina|esq\.?| y |&| esquina de )\b/i.test(text);
    return hasStreetNumber || looksLikeCorner;
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
        if (!isAddressValid(matchForm.venue)) {
          throw new Error('Ingresá una dirección con altura o una esquina');
        }
        if (matchForm.age_restricted && parseInt(matchForm.min_age || '0') > parseInt(matchForm.max_age || '0')) {
          throw new Error('El rango de edad no es válido');
        }
        const inferredCity = matchForm.inferred_city || inferCityFromText(matchForm.venue) || null;
        const normalizedAddress = normalizeAddressLabel(matchForm.venue.trim());
        await matchesAPI.create({
          football_type: parseInt(footballType),
          title: footballMode === 'futsal' ? 'Partido Futsal' : `Partido F${footballType}`,
          city: inferredCity,
          address: normalizedAddress,
          latitude: null,
          longitude: null,
          zone: normalizedAddress || inferredCity,
          match_date: matchForm.date,
          match_time: matchForm.time,
          max_players: Math.max(parseInt(matchForm.needed_players || '1') + 1, 2),
          match_gender: matchForm.match_gender,
          age_restricted: !!matchForm.age_restricted,
          min_age: matchForm.age_restricted ? parseInt(matchForm.min_age || '0') : null,
          max_age: matchForm.age_restricted ? parseInt(matchForm.max_age || '0') : null,
          goalkeepers_needed: parseInt(matchForm.goalkeepers_needed || '0'),
          match_kind: footballMode === 'futsal' ? 'futsal' : 'recreativo',
          visibility: 'public',
          requires_approval: true,
          allow_waitlist: true,
          price_per_player: 0,
          description: matchForm.description || null,
        });
      } else if (requestType === 'tournament_request') {
        if (!tournamentForm.name.trim()) {
          throw new Error('Completá el nombre del torneo');
        }
        if (!isAddressValid(tournamentForm.venue)) {
          throw new Error('Ingresá una dirección con altura o una esquina');
        }
        if (tournamentForm.age_restricted && parseInt(tournamentForm.min_age || '0') > parseInt(tournamentForm.max_age || '0')) {
          throw new Error('El rango de edad no es válido');
        }
        const inferredCity = tournamentForm.inferred_city || inferCityFromText(tournamentForm.venue) || null;
        const normalizedAddress = normalizeAddressLabel(tournamentForm.venue?.trim() || '');
        await tournamentsAPI.create({
          name: tournamentForm.name,
          football_type: parseInt(footballType),
          start_date: tournamentForm.start_date,
          max_teams: 2,
          entry_price: 0,
          city: inferredCity,
          venue_name: normalizedAddress || tournamentForm.venue?.trim() || null,
          zone: normalizedAddress || inferredCity,
          match_gender: tournamentForm.match_gender,
          age_restricted: !!tournamentForm.age_restricted,
          min_age: tournamentForm.age_restricted ? parseInt(tournamentForm.min_age || '0') : null,
          max_age: tournamentForm.age_restricted ? parseInt(tournamentForm.max_age || '0') : null,
          needed_players: parseInt(tournamentForm.needed_players || '1'),
          description: tournamentForm.description || null,
        });
      } else {
        if (!clubForm.club_name.trim()) {
          throw new Error('Completá el nombre del club/equipo');
        }
        if (!clubForm.position_needed.trim()) {
          throw new Error('Completá la posicion a buscar');
        }

        await clubsAPI.createRecruitmentForMe({
          club_name: clubForm.club_name.trim(),
          football_type: parseInt(footballType),
          category: clubForm.category.trim() || null,
          position_needed: clubForm.position_needed.trim(),
          city: clubForm.city.trim() || null,
          zone: clubForm.zone.trim() || null,
          needed_players: parseInt(clubForm.needed_players || '1'),
          description: clubForm.description.trim() || null,
          club_description: clubForm.description.trim() || null,
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
            <label className="card" style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', padding: '0.7rem' }}>
              <input type="radio" name="request_type" checked={requestType === 'club_recruitment'} onChange={() => setRequestType('club_recruitment')} />
              Para mi club o categoría
            </label>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Paso 2: Tipo de futbol</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {FOOTBALL_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                className={`btn ${footballMode === option.key ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1 }}
                onClick={() => setFootballMode(option.key)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {requestType === 'casual_match' ? (
          <div style={{ display: 'grid', gap: '0.6rem' }}>
            <div className="form-group">
              <label className="form-label">Dirección</label>
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
                value={matchForm.venue}
                onFocus={() => setShowAddressSuggestions(true)}
                onBlur={() => setTimeout(() => setShowAddressSuggestions(false), 120)}
                onChange={(e) => setMatchForm((p) => ({ ...p, venue: e.target.value, inferred_city: '', inferred_place_id: '' }))}
                required
              />
              {showAddressSuggestions && addressSuggestions.length > 0 && (
                <div className="card" style={{ marginTop: '0.35rem', padding: '0.25rem', maxHeight: 180, overflowY: 'auto' }}>
                  {addressSuggestions.map((s) => (
                    <button
                      key={s.placeId || s.label}
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ width: '100%', justifyContent: 'flex-start', marginBottom: '0.25rem' }}
                      onMouseDown={() => {
                        setMatchForm((p) => ({
                          ...p,
                          venue: s.label,
                          inferred_city: s.city || '',
                          inferred_place_id: s.placeId || '',
                        }));
                      }}
                    >
                      {s.label}
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
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Sexo del partido</label>
                <select className="form-select" value={matchForm.match_gender} onChange={(e) => setMatchForm((p) => ({ ...p, match_gender: e.target.value }))}>
                  <option value="masculino">Masculino</option>
                  <option value="femenino">Femenino</option>
                  <option value="mixto">Mixto</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Arqueros necesarios</label>
                <select className="form-select" value={matchForm.goalkeepers_needed} onChange={(e) => setMatchForm((p) => ({ ...p, goalkeepers_needed: e.target.value }))}>
                  <option value="0">Sin arqueros</option>
                  <option value="1">1 arquero</option>
                  <option value="2">2 arqueros</option>
                </select>
              </div>
            </div>
            <div className="form-group" style={{ marginTop: '-0.2rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input type="checkbox" checked={matchForm.age_restricted} onChange={(e) => setMatchForm((p) => ({ ...p, age_restricted: e.target.checked }))} />
                Restringir por edad
              </label>
            </div>
            {matchForm.age_restricted && (
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Edad mínima</label>
                  <input type="number" className="form-input" min="13" max="90" value={matchForm.min_age} onChange={(e) => setMatchForm((p) => ({ ...p, min_age: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Edad máxima</label>
                  <input type="number" className="form-input" min="13" max="90" value={matchForm.max_age} onChange={(e) => setMatchForm((p) => ({ ...p, max_age: e.target.value }))} required />
                </div>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Descripcion</label>
              <textarea className="form-textarea" value={matchForm.description} onChange={(e) => setMatchForm((p) => ({ ...p, description: e.target.value }))} />
            </div>
          </div>
        ) : requestType === 'tournament_request' ? (
          <div style={{ display: 'grid', gap: '0.6rem' }}>
            <div className="form-group">
              <label className="form-label">Nombre del torneo</label>
              <input className="form-input" value={tournamentForm.name} onChange={(e) => setTournamentForm((p) => ({ ...p, name: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label className="form-label">Dirección o complejo</label>
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
                value={tournamentForm.venue}
                onFocus={() => setShowAddressSuggestions(true)}
                onBlur={() => setTimeout(() => setShowAddressSuggestions(false), 120)}
                onChange={(e) => setTournamentForm((p) => ({ ...p, venue: e.target.value, inferred_city: '', inferred_place_id: '' }))}
              />
              {showAddressSuggestions && addressSuggestions.length > 0 && (
                <div className="card" style={{ marginTop: '0.35rem', padding: '0.25rem', maxHeight: 180, overflowY: 'auto' }}>
                  {addressSuggestions.map((s) => (
                    <button
                      key={s.placeId || s.label}
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ width: '100%', justifyContent: 'flex-start', marginBottom: '0.25rem' }}
                      onMouseDown={() => {
                        setTournamentForm((p) => ({
                          ...p,
                          venue: s.label,
                          inferred_city: s.city || '',
                          inferred_place_id: s.placeId || '',
                        }));
                      }}
                    >
                      {s.label}
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
              <label className="form-label">Sexo del torneo</label>
              <select className="form-select" value={tournamentForm.match_gender} onChange={(e) => setTournamentForm((p) => ({ ...p, match_gender: e.target.value }))}>
                <option value="masculino">Masculino</option>
                <option value="femenino">Femenino</option>
                <option value="mixto">Mixto</option>
              </select>
            </div>
            <div className="form-group" style={{ marginTop: '-0.2rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input type="checkbox" checked={tournamentForm.age_restricted} onChange={(e) => setTournamentForm((p) => ({ ...p, age_restricted: e.target.checked }))} />
                Restringir por edad
              </label>
            </div>
            {tournamentForm.age_restricted && (
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Edad mínima</label>
                  <input type="number" className="form-input" min="13" max="90" value={tournamentForm.min_age} onChange={(e) => setTournamentForm((p) => ({ ...p, min_age: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Edad máxima</label>
                  <input type="number" className="form-input" min="13" max="90" value={tournamentForm.max_age} onChange={(e) => setTournamentForm((p) => ({ ...p, max_age: e.target.value }))} required />
                </div>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Descripcion</label>
              <textarea className="form-textarea" value={tournamentForm.description} onChange={(e) => setTournamentForm((p) => ({ ...p, description: e.target.value }))} />
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '0.6rem' }}>
            <div style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
              Para publicar esta búsqueda necesitás tener aprobado el modo club desde tu perfil.
            </div>
            <div className="form-group">
              <label className="form-label">Nombre del club/equipo</label>
              <input
                className="form-input"
                value={clubForm.club_name}
                onChange={(e) => setClubForm((p) => ({ ...p, club_name: e.target.value }))}
                placeholder="Ej: Reserva Casildense"
                required
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Categoria</label>
                <input
                  className="form-input"
                  value={clubForm.category}
                  onChange={(e) => setClubForm((p) => ({ ...p, category: e.target.value }))}
                  placeholder="Ej: Sub-17 Femenina"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Posicion buscada</label>
                <input
                  className="form-input"
                  value={clubForm.position_needed}
                  onChange={(e) => setClubForm((p) => ({ ...p, position_needed: e.target.value }))}
                  placeholder="Ej: Arquera"
                  required
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Ciudad</label>
                <input
                  className="form-input"
                  value={clubForm.city}
                  onChange={(e) => setClubForm((p) => ({ ...p, city: e.target.value }))}
                  placeholder="Ej: Casilda"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Zona</label>
                <input
                  className="form-input"
                  value={clubForm.zone}
                  onChange={(e) => setClubForm((p) => ({ ...p, zone: e.target.value }))}
                  placeholder="Ej: Centro"
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Cantidad de jugadores</label>
              <input
                type="number"
                className="form-input"
                min="1"
                max="30"
                value={clubForm.needed_players}
                onChange={(e) => setClubForm((p) => ({ ...p, needed_players: e.target.value }))}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Descripcion</label>
              <textarea
                className="form-textarea"
                value={clubForm.description}
                onChange={(e) => setClubForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="Ej: Buscamos arquera titular para torneo local"
              />
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
