import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { clubsAPI, matchesAPI, tournamentsAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';

const FOOTBALL_TYPES = [
  { key: 'all', label: 'Todos', value: null },
  { key: 'futsal', label: 'Futsal', value: 5 },
  { key: '5', label: 'F5', value: 5 },
  { key: '7', label: 'F7', value: 7 },
  { key: '9', label: 'F9', value: 9 },
  { key: '11', label: 'F11', value: 11 },
];

const REQUEST_TYPE_OPTIONS = [
  { key: 'all', label: 'Todos', value: 'all' },
  { key: 'Match', label: 'Partido', value: 'Match' },
  { key: 'Tournament', label: 'Torneo', value: 'Tournament' },
  { key: 'Club', label: 'Club', value: 'Club' },
];

const GENDER_FILTERS = [
  { key: 'all', label: 'Todos', value: 'all' },
  { key: 'masculino', label: 'Masculino', value: 'masculino' },
  { key: 'femenino', label: 'Femenino', value: 'femenino' },
  { key: 'mixto', label: 'Mixto', value: 'mixto' },
];

function toLocalDate(dateStr) {
  const [y, m, d] = String(dateStr || '').split('-').map(Number);
  if (!y || !m || !d) return new Date(dateStr);
  return new Date(y, m - 1, d);
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const r = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatWhen(date, time) {
  const d = toLocalDate(date);
  const today = new Date();
  const baseToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const baseDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((baseDate - baseToday) / (1000 * 60 * 60 * 24));
  const hhmm = time ? String(time).slice(0, 5) : null;

  if (diffDays === 0) return hhmm ? `Hoy ${hhmm}` : 'Hoy';
  if (diffDays === 1) return hhmm ? `Mañana ${hhmm}` : 'Mañana';
  return hhmm ? `${baseDate.toLocaleDateString('es-AR')} ${hhmm}` : baseDate.toLocaleDateString('es-AR');
}

function computeAgeFromBirthDate(birthDate) {
  const d = new Date(birthDate || '');
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
}

function countryAbbrFromText(raw) {
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
    italia: 'IT',
    italy: 'IT',
    francia: 'FR',
    france: 'FR',
    portugal: 'PT',
    alemania: 'DE',
    germany: 'DE',
    'reino unido': 'GB',
    'united kingdom': 'GB',
  };
  const key = text.toLowerCase();
  if (map[key]) return map[key];
  return text.slice(0, 2).toUpperCase();
}

function formatLocation(address, city, zone) {
  const addressText = String(address || '').trim();
  const zoneText = String(zone || '').trim();
  const cityText = String(city || '').trim();

  const parts = addressText
    ? addressText.split(',').map((p) => p.trim()).filter(Boolean)
    : [];

  const street = parts[0] || zoneText || cityText || 'Sin ubicacion';
  const countryRaw = parts.length > 1 ? parts[parts.length - 1] : '';
  const country = countryAbbrFromText(countryRaw);

  const finalCity = cityText && cityText !== 'Sin ciudad'
    ? cityText
    : (parts.length > 1 ? parts.find((p) => p !== street && p !== countryRaw) || '' : '');

  const compact = [street];
  if (finalCity && finalCity.toLowerCase() !== street.toLowerCase()) compact.push(finalCity);
  if (country && country.toLowerCase() !== finalCity.toLowerCase()) compact.push(country);
  return compact.filter(Boolean).join(', ');
}

function matchesProfileRestrictions(item, profile) {
  if (!item) return true;
  const requiredGender = item.match_gender || 'mixto';
  const requiredAge = !!item.age_restricted;
  const minAge = item.min_age ?? null;
  const maxAge = item.max_age ?? null;
  const userGender = profile?.gender || null;
  const userAge = computeAgeFromBirthDate(profile?.birth_date) ?? profile?.age ?? null;

  if (requiredGender !== 'mixto') {
    if (!userGender) return false;
    if (requiredGender !== userGender) return false;
  }

  if (requiredAge) {
    if (!userAge) return false;
    if (minAge != null && userAge < minAge) return false;
    if (maxAge != null && userAge > maxAge) return false;
  }

  return true;
}

export default function Feed() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [matches, setMatches] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [clubRecruitments, setClubRecruitments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedFootballType, setSelectedFootballType] = useState('all');
  const [selectedRequestType, setSelectedRequestType] = useState('all');
  const [selectedGender, setSelectedGender] = useState('all');
  const [toast, setToast] = useState(null);
  const [coords, setCoords] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftFootballType, setDraftFootballType] = useState('all');
  const [draftRequestType, setDraftRequestType] = useState('all');
  const [draftGender, setDraftGender] = useState('all');
  const [venueMenuOpen, setVenueMenuOpen] = useState(false);
  const filtersWrapRef = useRef(null);
  const venueWrapRef = useRef(null);

  const buildNeedLabel = (joined, needed) => {
    const joinedNum = Math.max(Number(joined || 0), 0);
    const neededNum = Math.max(Number(needed || 0), 0);
    const missing = Math.max(neededNum - joinedNum, 0);
    if (missing === 1) return 'Falta 1 jugador';
    return `Faltan ${missing} jugadores`;
  };

  const buildSlotsVisual = (joined, needed) => {
    const totalSlots = Math.max(Number(needed || 0), 1);
    const filledSlots = Math.min(Math.max(Number(joined || 0), 0), totalSlots);
    const missingSlots = Math.max(totalSlots - filledSlots, 0);
    const maxVisible = Math.min(totalSlots, 6);
    const hiddenSlots = Math.max(totalSlots - maxVisible, 0);
    const visibleSlots = Array.from({ length: maxVisible }).map((_, idx) => (idx < Math.min(filledSlots, maxVisible) ? 'filled' : 'empty'));

    return {
      totalSlots,
      filledSlots,
      missingSlots,
      hiddenSlots,
      visibleSlots,
      missingLabel: missingSlots === 1 ? 'Falta 1 jugador' : `Faltan ${missingSlots} jugadores`,
    };
  };

  const cleanDescription = (rawDescription) => {
    const text = String(rawDescription || '').trim();
    if (!text) return null;
    const compact = text.toLowerCase().replace(/\s+/g, ' ').trim();
    if (compact.length < 6) return null;
    if (/^(test|prueba|lorem|ipsum|asdf|qwerty|xxx|na|n\/a|sin descripcion|sin descripción|descripcion|descripción|pendiente)$/i.test(compact)) return null;
    if (/^[x\-_.!?\s]+$/i.test(text)) return null;
    return text.length > 140 ? `${text.slice(0, 137)}...` : text;
  };

  const loadMatches = useCallback(async (showSpinner = false) => {
    try {
      if (showSpinner) setIsLoading(true);
      const selectedFootballDef = FOOTBALL_TYPES.find((f) => f.key === selectedFootballType) || FOOTBALL_TYPES[0];
      const footballType = selectedFootballDef.value;
      const matchData = await matchesAPI.getAll({ football_type: footballType }, user?.id);
      setMatches(matchData || []);

      try {
        const tournamentData = await tournamentsAPI.getAll({ football_type: footballType });
        setTournaments(tournamentData || []);
      } catch (tErr) {
        console.warn('Tournaments load warning:', tErr);
        setTournaments([]);
      }

      try {
        const recruitmentData = await clubsAPI.getRecruitments({ football_type: footballType });
        setClubRecruitments(recruitmentData || []);
      } catch (cErr) {
        console.warn('Club recruitments load warning:', cErr);
        setClubRecruitments([]);
      }
      setError(null);
    } catch (err) {
      console.error('Error loading matches:', err);
      setError('No se pudieron cargar los partidos.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedFootballType, user]);

  useEffect(() => {
    if (!filtersOpen) return;
    setDraftFootballType(selectedFootballType);
    setDraftRequestType(selectedRequestType);
    setDraftGender(selectedGender);
  }, [filtersOpen, selectedFootballType, selectedRequestType, selectedGender]);

  useEffect(() => {
    loadMatches(true);
  }, [loadMatches]);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      ({ coords: c }) => setCoords({ lat: c.latitude, lng: c.longitude }),
      () => setCoords(null),
      { enableHighAccuracy: false, timeout: 7000, maximumAge: 300000 }
    );
  }, []);

  useEffect(() => {
    const handleDocClick = (event) => {
      if (filtersOpen && filtersWrapRef.current && !filtersWrapRef.current.contains(event.target)) {
        setFiltersOpen(false);
      }
      if (venueMenuOpen && venueWrapRef.current && !venueWrapRef.current.contains(event.target)) {
        setVenueMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleDocClick);
    return () => document.removeEventListener('mousedown', handleDocClick);
  }, [filtersOpen, venueMenuOpen]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const applyFilters = () => {
    setSelectedFootballType(draftFootballType);
    setSelectedRequestType(draftRequestType);
    setSelectedGender(draftGender);
    setFiltersOpen(false);
  };

  const clearFilters = () => {
    setDraftFootballType('all');
    setDraftRequestType('all');
    setDraftGender('all');
    setSelectedFootballType('all');
    setSelectedRequestType('all');
    setSelectedGender('all');
  };

  const handleJoin = async (matchId) => {
    if (!user) { navigate('/login'); return; }
    try {
      const res = await matchesAPI.requestJoin(matchId);
      if (res?.alreadyRequested) {
        showToast('Revisá las políticas de la app para este caso', 'error');
        navigate('/support', { state: { openPolicy: 'abandon' } });
      } else if (res?.blockedByAbandon) {
        showToast('Aplican políticas por abandono cercano al horario', 'error');
        navigate('/support', { state: { openPolicy: 'abandon' } });
      } else {
        showToast('¡Solicitud enviada! 🎉');
      }
      loadMatches(false);
    } catch (err) {
      showToast(err.message || 'Error al solicitar unirse', 'error');
    }
  };

  const handleLeave = async (matchId) => {
    try {
      await matchesAPI.leave(matchId);
      showToast('Saliste del partido');
      loadMatches(false);
    } catch (err) {
      showToast(err.message || 'Error al salir', 'error');
    }
  };

  const handleCancel = async (matchId) => {
    try {
      await matchesAPI.cancelRequest(matchId);
      showToast('Solicitud cancelada');
      loadMatches(false);
    } catch (err) {
      showToast(err.message || 'Error al cancelar solicitud', 'error');
    }
  };

  const handleDelete = async (matchId) => {
    if (!confirm('Seguro queres eliminar este partido?')) return;
    try {
      await matchesAPI.deleteMatch(matchId);
      showToast('Partido eliminado');
      loadMatches(false);
    } catch (err) {
      showToast(err.message || 'Error al eliminar partido', 'error');
    }
  };

  const handleApplyTournament = async (tournamentId) => {
    if (!user) { navigate('/login'); return; }
    try {
      await tournamentsAPI.applyRequest(tournamentId);
      showToast('Postulacion enviada');
    } catch (err) {
      showToast(err.message || 'Error al postularse', 'error');
    }
  };

  const handleDeleteClubRecruitment = async (recruitmentId) => {
    if (!confirm('Seguro queres eliminar esta búsqueda de jugadores del club?')) return;
    try {
      await clubsAPI.deleteRecruitment(recruitmentId);
      showToast('Petición de club eliminada');
      loadMatches(false);
    } catch (err) {
      showToast(err.message || 'No se pudo eliminar la petición', 'error');
    }
  };

  const normalizeRequests = () => {
    const matchRows = (matches || []).map((m) => {
      const lat = m.latitude != null ? Number(m.latitude) : null;
      const lng = m.longitude != null ? Number(m.longitude) : null;
      const distanceKm = coords && Number.isFinite(lat) && Number.isFinite(lng)
        ? haversineKm(coords.lat, coords.lng, lat, lng)
        : null;

      return {
        kind: 'Match',
        id: m.id,
        football_type: m.football_type,
        address: m.address || '',
        city: m.city && m.city !== 'Sin ciudad' ? m.city : '',
        zone: m.zone || '',
        locationLabel: formatLocation(m.address || '', m.city || '', m.zone || ''),
        date: m.match_date,
        time: m.match_time,
        joined: m.players_joined ?? m.current_players ?? 0,
        total: m.max_players,
        needed_players: Math.max((m.max_players || 1) - 1, 1),
        joined_needed_players: Math.max((m.players_joined ?? m.current_players ?? 0) - 1, 0),
        organizer_name: m.creator_name || 'Anónimo',
        organizer_id: m.owner_id ?? m.creator_id ?? null,
        raw: m,
        distanceKm,
        match_gender: m.match_gender || 'mixto',
        age_restricted: !!m.age_restricted,
        min_age: m.min_age ?? null,
        max_age: m.max_age ?? null,
        goalkeepers_needed: m.goalkeepers_needed ?? 0,
        description: m.description || null,
      };
    });

    const tournamentRows = (tournaments || []).map((t) => ({
      kind: 'Tournament',
      id: t.id,
      football_type: t.football_type,
      address: t.venue_name || '',
      city: (t.city && t.city !== 'Sin ciudad' ? t.city : '') || t.zone || '',
      zone: t.zone || '',
      locationLabel: formatLocation(t.venue_name || '', t.city || '', t.zone || ''),
      date: t.start_date,
      time: null,
      joined: null,
      total: null,
      organizer_name: t.organizer_name || 'Anónimo',
      raw: t,
      distanceKm: null,
      match_gender: t.match_gender || 'mixto',
      age_restricted: !!t.age_restricted,
      min_age: t.min_age ?? null,
      max_age: t.max_age ?? null,
      goalkeepers_needed: null,
      needed_players: t.needed_players ?? 1,
      joined_needed_players: 0,
      description: t.description || null,
    }));

    const clubRows = (clubRecruitments || []).map((c) => ({
      kind: 'Club',
      id: c.id,
      football_type: c.football_type,
      address: c.zone || c.city || '',
      city: c.city || c.clubs?.city || '',
      zone: c.zone || c.clubs?.zone || '',
      locationLabel: formatLocation('', c.city || c.clubs?.city || '', c.zone || c.clubs?.zone || ''),
      date: c.created_at,
      time: null,
      joined: null,
      total: null,
      organizer_name: c.clubs?.name || 'Club',
      organizer_id: c.clubs?.creator_id || null,
      raw: c,
      distanceKm: null,
      match_gender: c.match_gender || 'mixto',
      age_restricted: false,
      min_age: null,
      max_age: null,
      goalkeepers_needed: null,
      needed_players: c.needed_players ?? 1,
      joined_needed_players: 0,
      position_needed: c.position_needed || null,
      category: c.category || null,
      club_address: c.clubs?.address || null,
      club_phone: c.clubs?.phone || null,
      club_contact_name: c.clubs?.contact_name || null,
      description: c.description || c.clubs?.description || null,
    }));

    let merged = [...matchRows, ...tournamentRows, ...clubRows];

    merged = merged.filter((row) => matchesProfileRestrictions(row, profile));

    if (selectedRequestType !== 'all') {
      merged = merged.filter((row) => row.kind === selectedRequestType);
    }

    if (selectedFootballType === 'futsal') {
      merged = merged.filter((row) => row.football_type === 5 && String(row.raw?.match_kind || '').toLowerCase() === 'futsal');
    }

    if (selectedGender !== 'all') {
      merged = merged.filter((row) => (row.match_gender || 'mixto') === selectedGender);
    }

    return merged.sort((a, b) => {
      const ad = a.kind === 'Match' ? (a.distanceKm ?? Number.POSITIVE_INFINITY) : Number.POSITIVE_INFINITY;
      const bd = b.kind === 'Match' ? (b.distanceKm ?? Number.POSITIVE_INFINITY) : Number.POSITIVE_INFINITY;
      if (ad !== bd) return ad - bd;
      return toLocalDate(a.date).getTime() - toLocalDate(b.date).getTime();
    });
  };

  const requests = normalizeRequests();

  const activeFilterChips = [];
  if (selectedFootballType !== 'all') {
    const f = FOOTBALL_TYPES.find((x) => x.key === selectedFootballType);
    if (f) activeFilterChips.push(`Fútbol: ${f.label}`);
  }
  if (selectedRequestType !== 'all') {
    const t = REQUEST_TYPE_OPTIONS.find((x) => x.value === selectedRequestType);
    if (t) activeFilterChips.push(`Tipo: ${t.label}`);
  }
  if (selectedGender !== 'all') {
    const g = GENDER_FILTERS.find((x) => x.value === selectedGender);
    if (g) activeFilterChips.push(`Género: ${g.label}`);
  }

  const getRequestCardTitle = (req) => {
    if (req.kind === 'Match') {
      return String(req.raw?.match_kind || '').toLowerCase() === 'futsal' ? 'Partido Futsal' : `Partido F${req.football_type || '-'}`;
    }
    if (req.kind === 'Tournament') {
      return req.raw?.name || `Torneo F${req.football_type || '-'}`;
    }
    return req.organizer_name ? `Búsqueda de jugadores · ${req.organizer_name}` : 'Búsqueda de jugadores · Club';
  };

  return (
    <div className="page-content">
      {toast && (
        <div className={`toast toast-${toast.type}`}>{toast.message}</div>
      )}

      <div className="feed-header-compact">
        <div className="feed-header-copy">
          <h1 className="feed-title">¿Tenés ganas de jugar?</h1>
          <p className="feed-subtitle">Encontrá partidos, torneos o un club y sumate.</p>
        </div>
        <div className="feed-header-actions">
          <div className="feed-filter-wrap" ref={filtersWrapRef}>
            <button className="btn btn-secondary btn-sm" type="button" onClick={() => setFiltersOpen((f) => !f)}>
              Filtros
            </button>
            {filtersOpen && (
              <>
                <button className="feed-filters-backdrop" type="button" onClick={() => setFiltersOpen(false)} aria-label="Cerrar filtros" />
                <div className="feed-filters-panel card" role="dialog" aria-modal="true" aria-label="Filtros de publicaciones">
                  <h3>Filtros</h3>

                  <div className="feed-filter-section">
                    <div className="feed-filter-label">Tipo de fútbol</div>
                    <div className="feed-filter-options">
                      {FOOTBALL_TYPES.filter((f) => f.key !== 'all').map((f) => (
                        <button
                          key={f.key}
                          type="button"
                          className={`area-pill ${draftFootballType === f.key ? 'active' : ''}`}
                          onClick={() => setDraftFootballType(f.key)}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="feed-filter-section">
                    <div className="feed-filter-label">Tipo</div>
                    <div className="feed-filter-options">
                      {REQUEST_TYPE_OPTIONS.filter((t) => t.value !== 'all').map((t) => (
                        <button
                          key={t.key}
                          type="button"
                          className={`area-pill ${draftRequestType === t.value ? 'active' : ''}`}
                          onClick={() => setDraftRequestType(t.value)}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="feed-filter-section">
                    <div className="feed-filter-label">Género</div>
                    <div className="feed-filter-options">
                      {GENDER_FILTERS.filter((g) => g.value !== 'all').map((g) => (
                        <button
                          key={g.key}
                          type="button"
                          className={`area-pill ${draftGender === g.value ? 'active' : ''}`}
                          onClick={() => setDraftGender(g.value)}
                        >
                          {g.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="feed-filter-actions">
                    <button className="btn btn-primary" type="button" onClick={applyFilters}>Aplicar filtros</button>
                    <button className="btn btn-secondary" type="button" onClick={clearFilters}>Limpiar filtros</button>
                  </div>
                </div>
              </>
            )}
          </div>
          <div className="feed-venue-menu-wrap" ref={venueWrapRef}>
            <button className="btn btn-secondary btn-sm" type="button" onClick={() => setVenueMenuOpen((v) => !v)}>
              Mi cancha
            </button>
            {venueMenuOpen && (
              <div className="feed-venue-menu card">
                <button className="btn btn-secondary btn-sm" type="button" onClick={() => { setVenueMenuOpen(false); navigate('/venues'); }}>
                  Publicar cancha
                </button>
                <button className="btn btn-secondary btn-sm" type="button" onClick={() => { setVenueMenuOpen(false); navigate('/venues'); }}>
                  Gestionar cancha
                </button>
                <button className="btn btn-secondary btn-sm" type="button" onClick={() => { setVenueMenuOpen(false); navigate('/venues'); }}>
                  Mi cancha
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {activeFilterChips.length > 0 && (
        <div className="feed-active-filters">
          {activeFilterChips.map((chip) => (
            <span key={chip} className="badge badge-type">{chip}</span>
          ))}
        </div>
      )}

      {isLoading ? (
        <div style={{ display: 'grid', gap: '0.8rem' }}>
          <div className="skeleton-card"></div>
          <div className="skeleton-card"></div>
          <div className="skeleton-card"></div>
        </div>
      ) : error ? (
        <div className="empty-state">
          <div className="empty-state-icon">⚠️</div>
          <div className="empty-state-title">{error}</div>
        </div>
      ) : requests.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">⚽</div>
          <div className="empty-state-title">No hay solicitudes compatibles para tu perfil</div>
          <p style={{ marginBottom: '1.5rem', color: 'var(--color-text-muted)' }}>
            Probá otro filtro o creá una solicitud nueva
          </p>
          <button className="btn btn-primary" onClick={() => navigate(user ? '/create-match' : '/login')}>
            Buscar jugadores
          </button>
        </div>
      ) : (
        requests.map((req) => (
          <div
            key={`${req.kind}-${req.id}`}
            className="card match-card"
            style={{ cursor: req.kind === 'Match' ? 'pointer' : (req.kind === 'Club' && req.organizer_id ? 'pointer' : 'default') }}
            onClick={() => {
              if (req.kind === 'Match') {
                navigate(`/match/${req.id}`);
                return;
              }
              if (req.kind === 'Club' && req.organizer_id) {
                navigate(`/users/${req.organizer_id}`);
              }
            }}
          >
            <div className="match-card-header">
              <div className="match-type">
                <h3 className="match-card-title">{getRequestCardTitle(req)}</h3>
              </div>
              <div className="match-badges-compact">
                <span className="badge badge-type match-badge-soft">{req.kind === 'Club' ? 'Club' : `F${req.football_type || '-'}`}</span>
                <span className="badge badge-type match-badge-soft">{req.match_gender || 'mixto'}</span>
              </div>
            </div>

            <div className="match-info">
              <div className="match-info-row">
                <span className="info-icon">📍</span>
                <span>{req.locationLabel || 'Sin ubicacion'}</span>
              </div>
              <div className="match-info-row">
                <span className="info-icon">🕒</span>
                <span>{formatWhen(req.date, req.time)}</span>
              </div>
              <div className="match-info-row">
                <span className="info-icon">👤</span>
                {req.organizer_id ? (
                  <button
                    type="button"
                    className="link-button-inline"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/users/${req.organizer_id}`);
                    }}
                  >
                    Organiza: {req.organizer_name || 'Anónimo'}
                  </button>
                ) : (
                  <span>Organiza: {req.organizer_name || 'Anónimo'}</span>
                )}
              </div>
              {req.kind === 'Match' ? (
                (() => {
                  const slots = buildSlotsVisual(req.joined_needed_players, req.needed_players);
                  return (
                    <div className="match-info-row match-cupos-inline">
                      <span className="info-icon">👥</span>
                      <span className="match-cupos-label">Cupos:</span>
                      <span className="match-slots-track-inline" role="img" aria-label={`${slots.filledSlots} cupos cubiertos de ${slots.totalSlots}`}>
                        {slots.visibleSlots.map((state, idx) => (
                          <span key={`slot-${req.id}-${idx}`} className={`match-slot-inline ${state === 'filled' ? 'is-filled' : 'is-empty'}`}>
                            {state === 'filled' ? '●' : '○'}
                          </span>
                        ))}
                        {slots.hiddenSlots > 0 && <span className="match-slots-more">+{slots.hiddenSlots}</span>}
                      </span>
                      <span className="match-cupos-text">
                        {slots.missingLabel}
                        {req.goalkeepers_needed > 0 ? ` · ${req.goalkeepers_needed} arquero${req.goalkeepers_needed === 2 ? 's' : ''}` : ''}
                      </span>
                    </div>
                  );
                })()
              ) : req.kind === 'Club' ? (
                <>
                  <div className="match-info-row">
                    <span className="info-icon">🎯</span>
                    <span>{req.position_needed ? `Buscan ${req.position_needed}` : 'Búsqueda abierta de jugadores'}</span>
                  </div>
                  {req.club_contact_name && (
                    <div className="match-info-row">
                      <span className="info-icon">🙋</span>
                      <span>Contacto: {req.club_contact_name}</span>
                    </div>
                  )}
                  {req.club_address && (
                    <div className="match-info-row">
                      <span className="info-icon">🏠</span>
                      <span>{req.club_address}</span>
                    </div>
                  )}
                  {req.club_phone && (
                    <div className="match-info-row">
                      <span className="info-icon">📞</span>
                      <span>{req.club_phone}</span>
                    </div>
                  )}
                  <div className="match-info-row">
                    <span className="info-icon">👥</span>
                    <span>{buildNeedLabel(req.joined_needed_players, req.needed_players)}{req.category ? ` · ${req.category}` : ''}</span>
                  </div>
                </>
              ) : (
                <div className="match-info-row">
                  <span className="info-icon">👥</span>
                  <span>{buildNeedLabel(req.joined_needed_players, req.needed_players)}</span>
                </div>
              )}
              {cleanDescription(req.description) && (
                <div className="match-info-row">
                  <span className="info-icon">💬</span>
                  <span>{cleanDescription(req.description)}</span>
                </div>
              )}
              {req.kind === 'Match' && req.distanceKm != null && (
                <div className="match-info-row">
                  <span className="info-icon">📏</span>
                  <span>{req.distanceKm.toFixed(1)} km de vos</span>
                </div>
              )}
            </div>

            <div className="match-card-footer">
              {req.kind === 'Match' ? (
                (() => {
                  const m = req.raw || {};
                  const playersJoined = m.players_joined ?? m.current_players ?? 0;
                  const maxPlayers = m.max_players || 0;
                  const isFull = maxPlayers > 0 && playersJoined >= maxPlayers;
                  const matchCreatorId = m.owner_id ?? m.creator_id ?? null;
                  const isCreator = Boolean(user?.id && matchCreatorId && String(user.id) === String(matchCreatorId));

                  if (isCreator) {
                    return (
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <button className="btn btn-sm btn-secondary" onClick={(e) => { e.stopPropagation(); navigate(`/match/${req.id}`); }}>
                          Editar
                        </button>
                        <button className="btn btn-sm btn-danger" onClick={(e) => { e.stopPropagation(); handleDelete(req.id); }}>
                          Eliminar
                        </button>
                      </div>
                    );
                  }

                  if (m.has_joined) {
                    return (
                      <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); handleLeave(req.id); }}>
                        Salir
                      </button>
                    );
                  }

                  if (m.has_requested) {
                    return (
                      <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); handleCancel(req.id); }}>
                        Cancelar solicitud
                      </button>
                    );
                  }

                  if (isFull) {
                    return <span className="badge badge-full">Completo</span>;
                  }

                  return (
                    <button className="btn btn-primary btn-sm" onClick={(e) => { e.stopPropagation(); handleJoin(req.id); }}>
                      Quiero sumarme
                    </button>
                  );
                })()
              ) : req.kind === 'Tournament' ? (
                <button className="btn btn-primary btn-sm" onClick={(e) => { e.stopPropagation(); handleApplyTournament(req.id); }}>
                  Quiero sumarme
                </button>
              ) : (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (req.organizer_id) {
                        navigate(`/users/${req.organizer_id}`);
                      }
                    }}
                  >
                    Ver club
                  </button>
                  {user?.id && req.raw?.clubs?.creator_id && String(user.id) === String(req.raw.clubs.creator_id) && (
                    <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); handleDeleteClubRecruitment(req.id); }}>
                      Eliminar petición
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
