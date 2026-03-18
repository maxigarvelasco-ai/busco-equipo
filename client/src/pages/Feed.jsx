import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { clubsAPI, matchesAPI, tournamentsAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';

const FOOTBALL_TYPES = [
  { key: 'all', labelKey: 'all', value: null },
  { key: 'futsal', labelKey: 'football_futsal', value: 5 },
  { key: '5', labelKey: 'football_5', value: 5 },
  { key: '7', labelKey: 'football_7', value: 7 },
  { key: '9', labelKey: 'football_9', value: 9 },
  { key: '11', labelKey: 'football_11', value: 11 },
];

const REQUEST_TYPE_OPTIONS = [
  { key: 'all', labelKey: 'all', value: 'all' },
  { key: 'Match', labelKey: 'req_match', value: 'Match' },
  { key: 'Tournament', labelKey: 'req_tournament', value: 'Tournament' },
  { key: 'Club', labelKey: 'req_club', value: 'Club' },
];

const GENDER_FILTERS = [
  { key: 'all', labelKey: 'all', value: 'all' },
  { key: 'masculino', labelKey: 'gender_male', value: 'masculino' },
  { key: 'femenino', labelKey: 'gender_female', value: 'femenino' },
  { key: 'mixto', labelKey: 'gender_mixed', value: 'mixto' },
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

function formatWhen(date, time, language, t) {
  const d = toLocalDate(date);
  const today = new Date();
  const baseToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const baseDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const locale = language === 'en' ? 'en-US' : language === 'pt' ? 'pt-BR' : 'es-AR';
  const diffDays = Math.round((baseDate - baseToday) / (1000 * 60 * 60 * 24));
  const hhmm = time ? String(time).slice(0, 5) : null;

  if (diffDays === 0) return hhmm ? `${t('today')} ${hhmm}` : t('today');
  if (diffDays === 1) return hhmm ? `${t('tomorrow')} ${hhmm}` : t('tomorrow');
  return hhmm ? `${baseDate.toLocaleDateString(locale)} ${hhmm}` : baseDate.toLocaleDateString(locale);
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

  const street = parts[0] || zoneText || cityText || '';
  const countryRaw = parts.length > 1 ? parts[parts.length - 1] : '';
  const country = countryAbbrFromText(countryRaw);

  const finalCity = cityText && cityText !== 'Sin ciudad'
    ? cityText
    : (parts.length > 1 ? parts.find((p) => p !== street && p !== countryRaw) || '' : '');

  const compact = [street].filter(Boolean);
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
  const { t, language } = useUI();
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
  const filtersWrapRef = useRef(null);

  const buildNeedLabel = (joined, needed) => {
    const neededNum = Math.max(Number(needed || 0), 0);
    const missing = Math.max(neededNum - Math.max(Number(joined || 0), 0), 0);
    if (missing === 1) return t('need_one_player');
    return t('need_many_players').replace('{count}', String(missing));
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
      missingLabel: missingSlots === 1 ? t('need_one_player') : t('need_many_players').replace('{count}', String(missingSlots)),
    };
  };

  const cleanDescription = (rawDescription) => {
    const text = String(rawDescription || '').trim();
    if (!text) return null;
    const compact = text.toLowerCase().replace(/\s+/g, ' ').trim();
    if (compact.length < 10) return null;
    if (/^(test|prueba|lorem|ipsum|asdf|qwerty|xxx|na|n\/a|sin descripcion|sin descripción|descripcion|descripción|pendiente)$/i.test(compact)) return null;
    if (/^[x\-_.!?\s]+$/i.test(text)) return null;
    if (/(.)\1{4,}/.test(compact)) return null;

    const words = compact.split(' ').filter(Boolean);
    if (words.length < 3) return null;

    const nonWordRatio = (compact.match(/[^a-z0-9áéíóúüñ\s]/gi) || []).length / compact.length;
    if (nonWordRatio > 0.2) return null;

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
      setError(t('could_not_load_matches'));
    } finally {
      setIsLoading(false);
    }
  }, [selectedFootballType, user, t]);

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
    };

    document.addEventListener('mousedown', handleDocClick);
    return () => document.removeEventListener('mousedown', handleDocClick);
  }, [filtersOpen]);

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
        showToast(t('app_policy_hint'), 'error');
        navigate('/support', { state: { openPolicy: 'abandon' } });
      } else if (res?.blockedByAbandon) {
        showToast(t('abandon_policy_hint'), 'error');
        navigate('/support', { state: { openPolicy: 'abandon' } });
      } else {
        showToast(t('request_sent'));
      }
      loadMatches(false);
    } catch (err) {
      showToast(err.message || t('join_error'), 'error');
    }
  };

  const handleLeave = async (matchId) => {
    try {
      await matchesAPI.leave(matchId);
      showToast(t('left_match'));
      loadMatches(false);
    } catch (err) {
      showToast(err.message || t('leave_error'), 'error');
    }
  };

  const handleCancel = async (matchId) => {
    try {
      await matchesAPI.cancelRequest(matchId);
      showToast(t('request_cancelled'));
      loadMatches(false);
    } catch (err) {
      showToast(err.message || t('cancel_request_error'), 'error');
    }
  };

  const handleDelete = async (matchId) => {
    if (!confirm(t('confirm_delete_match'))) return;
    try {
      await matchesAPI.deleteMatch(matchId);
      showToast(t('match_deleted'));
      loadMatches(false);
    } catch (err) {
      showToast(err.message || t('delete_match_error'), 'error');
    }
  };

  const handleApplyTournament = async (tournamentId) => {
    if (!user) { navigate('/login'); return; }
    try {
      await tournamentsAPI.applyRequest(tournamentId);
      showToast(t('application_sent'));
    } catch (err) {
      showToast(err.message || t('application_error'), 'error');
    }
  };

  const handleDeleteClubRecruitment = async (recruitmentId) => {
    if (!confirm(t('confirm_delete_club_request'))) return;
    try {
      await clubsAPI.deleteRecruitment(recruitmentId);
      showToast(t('club_request_deleted'));
      loadMatches(false);
    } catch (err) {
      showToast(err.message || t('delete_club_request_error'), 'error');
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
        organizer_name: m.creator_name || null,
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
      organizer_name: t.organizer_name || null,
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
      organizer_name: c.clubs?.name || null,
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
    if (f) activeFilterChips.push(`${t('filter_chip_football')}: ${t(f.labelKey)}`);
  }
  if (selectedRequestType !== 'all') {
    const requestType = REQUEST_TYPE_OPTIONS.find((x) => x.value === selectedRequestType);
    if (requestType) activeFilterChips.push(`${t('filter_chip_type')}: ${t(requestType.labelKey)}`);
  }
  if (selectedGender !== 'all') {
    const gender = GENDER_FILTERS.find((x) => x.value === selectedGender);
    if (gender) activeFilterChips.push(`${t('filter_chip_gender')}: ${t(gender.labelKey)}`);
  }

  const getRequestCardTitle = (req) => {
    if (req.kind === 'Match') {
      return String(req.raw?.match_kind || '').toLowerCase() === 'futsal'
        ? t('futsal_match_title')
        : t('match_title').replace('{type}', String(req.football_type || '-'));
    }
    if (req.kind === 'Tournament') {
      return req.raw?.name || t('tournament_title').replace('{type}', String(req.football_type || '-'));
    }
    return req.organizer_name
      ? t('club_recruitment_title').replace('{name}', req.organizer_name)
      : t('club_recruitment_title_generic');
  };

  return (
    <div className="page-content">
      {toast && (
        <div className={`toast toast-${toast.type}`}>{toast.message}</div>
      )}

      <div className="feed-header-compact">
        <div className="feed-header-copy">
          <h1 className="feed-title">{t('feed_title')}</h1>
          <p className="feed-subtitle">{t('feed_subtitle')}</p>
        </div>
        <div className="feed-header-actions">
          <div className="feed-filter-wrap" ref={filtersWrapRef}>
            <button className="btn btn-secondary btn-sm" type="button" onClick={() => setFiltersOpen((f) => !f)}>
              {t('filters')}
            </button>
            {filtersOpen && (
              <>
                <button className="feed-filters-backdrop" type="button" onClick={() => setFiltersOpen(false)} aria-label={t('close_filters')} />
                <div className="feed-filters-panel card" role="dialog" aria-modal="true" aria-label={t('filters_dialog')}>
                  <h3>{t('filters')}</h3>

                  <div className="feed-filter-section">
                    <div className="feed-filter-label">{t('filter_football_type')}</div>
                    <div className="feed-filter-options">
                      {FOOTBALL_TYPES.filter((f) => f.key !== 'all').map((f) => (
                        <button
                          key={f.key}
                          type="button"
                          className={`area-pill ${draftFootballType === f.key ? 'active' : ''}`}
                          onClick={() => setDraftFootballType(f.key)}
                        >
                          {t(f.labelKey)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="feed-filter-section">
                    <div className="feed-filter-label">{t('filter_request_type')}</div>
                    <div className="feed-filter-options">
                      {REQUEST_TYPE_OPTIONS.filter((requestTypeOption) => requestTypeOption.value !== 'all').map((requestTypeOption) => (
                        <button
                          key={requestTypeOption.key}
                          type="button"
                          className={`area-pill ${draftRequestType === requestTypeOption.value ? 'active' : ''}`}
                          onClick={() => setDraftRequestType(requestTypeOption.value)}
                        >
                          {t(requestTypeOption.labelKey)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="feed-filter-section">
                    <div className="feed-filter-label">{t('filter_gender')}</div>
                    <div className="feed-filter-options">
                      {GENDER_FILTERS.filter((g) => g.value !== 'all').map((g) => (
                        <button
                          key={g.key}
                          type="button"
                          className={`area-pill ${draftGender === g.value ? 'active' : ''}`}
                          onClick={() => setDraftGender(g.value)}
                        >
                          {t(g.labelKey)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="feed-filter-actions">
                    <button className="btn btn-primary" type="button" onClick={applyFilters}>{t('apply_filters')}</button>
                    <button className="btn btn-secondary" type="button" onClick={clearFilters}>{t('clear_filters')}</button>
                  </div>
                </div>
              </>
            )}
          </div>
          <div className="feed-canchas-action">
            <button
              className="btn btn-secondary btn-sm"
              type="button"
              title={t('courts_hint')}
              aria-label={`${t('courts')}: ${t('courts_hint')}`}
              onClick={() => navigate('/venues')}
            >
              {t('courts')}
            </button>
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
          <div className="empty-state-title">{t('empty_feed_title')}</div>
          <p style={{ marginBottom: '1.5rem', color: 'var(--color-text-muted)' }}>
            {t('empty_feed_subtitle')}
          </p>
          <button className="btn btn-primary" onClick={() => navigate(user ? '/create-match' : '/login')}>
            {t('search_players')}
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
                <span className="badge badge-type match-badge-soft">{req.kind === 'Club' ? t('req_club') : `F${req.football_type || '-'}`}</span>
                <span className="badge badge-type match-badge-soft">{req.match_gender === 'masculino' ? t('gender_male') : req.match_gender === 'femenino' ? t('gender_female') : t('gender_mixed')}</span>
              </div>
            </div>

            <div className="match-info">
              <div className="match-info-row">
                <span className="info-icon">📍</span>
                <span>{req.locationLabel || t('no_location')}</span>
              </div>
              <div className="match-info-row">
                <span className="info-icon">🕒</span>
                <span>{formatWhen(req.date, req.time, language, t)}</span>
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
                    {t('organize_by')}: {req.organizer_name || t('anonymous')}
                  </button>
                ) : (
                  <span>{t('organize_by')}: {req.organizer_name || t('anonymous')}</span>
                )}
              </div>
              {req.kind === 'Match' ? (
                (() => {
                  const slots = buildSlotsVisual(req.joined_needed_players, req.needed_players);
                  return (
                    <div className="match-cupos-inline-wrap">
                      <div className="match-info-row match-cupos-inline">
                      <span className="info-icon">👥</span>
                      <span className="match-cupos-label">{t('slots')}:</span>
                      <span className="match-slots-track-inline" role="img" aria-label={`${slots.filledSlots}/${slots.totalSlots}`}>
                        {slots.visibleSlots.map((state, idx) => (
                          <span key={`slot-${req.id}-${idx}`} className={`match-slot-inline ${state === 'filled' ? 'is-filled' : 'is-empty'}`}>
                            {state === 'filled' ? '●' : '○'}
                          </span>
                        ))}
                        {slots.hiddenSlots > 0 && <span className="match-slots-more">+{slots.hiddenSlots}</span>}
                      </span>
                      <span className="match-cupos-text">
                        {slots.missingLabel}
                        {req.goalkeepers_needed > 0 ? ` · ${(req.goalkeepers_needed === 1 ? t('goalkeepers_needed') : t('goalkeepers_needed_plural')).replace('{count}', String(req.goalkeepers_needed))}` : ''}
                      </span>
                      </div>
                    </div>
                  );
                })()
              ) : req.kind === 'Club' ? (
                <>
                  <div className="match-info-row">
                    <span className="info-icon">🎯</span>
                    <span>{req.position_needed ? t('looking_for_position').replace('{position}', req.position_needed) : t('open_recruitment')}</span>
                  </div>
                  {req.club_contact_name && (
                    <div className="match-info-row">
                      <span className="info-icon">🙋</span>
                      <span>{t('contact_person')}: {req.club_contact_name}</span>
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
                  <span>{t('km_from_you').replace('{km}', req.distanceKm.toFixed(1))}</span>
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
                          {t('edit')}
                        </button>
                        <button className="btn btn-sm btn-danger" onClick={(e) => { e.stopPropagation(); handleDelete(req.id); }}>
                          {t('delete')}
                        </button>
                      </div>
                    );
                  }

                  if (m.has_joined) {
                    return (
                      <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); handleLeave(req.id); }}>
                        {t('leave')}
                      </button>
                    );
                  }

                  if (m.has_requested) {
                    return (
                      <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); handleCancel(req.id); }}>
                        {t('cancel_request')}
                      </button>
                    );
                  }

                  if (isFull) {
                    return <span className="badge badge-full">{t('full')}</span>;
                  }

                  return (
                    <button className="btn btn-primary btn-sm" onClick={(e) => { e.stopPropagation(); handleJoin(req.id); }}>
                      {t('join')}
                    </button>
                  );
                })()
              ) : req.kind === 'Tournament' ? (
                <button className="btn btn-primary btn-sm" onClick={(e) => { e.stopPropagation(); handleApplyTournament(req.id); }}>
                  {t('join')}
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
                    {t('view_club')}
                  </button>
                  {user?.id && req.raw?.clubs?.creator_id && String(user.id) === String(req.raw.clubs.creator_id) && (
                    <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); handleDeleteClubRecruitment(req.id); }}>
                      {t('delete_request')}
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
