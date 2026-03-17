import { supabase } from './supabaseClient';

// ========== MATCHES ==========

export const matchesAPI = {
  // Get matches feed (uses the matches_feed view)
  async getAll(filters = {}, currentUserId = null) {
    let query = supabase
      .from('matches_feed')
      .select('*');

    if (filters.zone && filters.zone !== 'Todas') {
      query = query.eq('zone', filters.zone);
    }
    if (filters.football_type) {
      query = query.eq('football_type', parseInt(filters.football_type));
    }
    if (filters.visibility && filters.visibility !== 'all') {
      query = query.eq('visibility', filters.visibility);
    }
    if (filters.match_kind) {
      query = query.eq('match_kind', filters.match_kind);
    }

    query = query.order('is_featured', { ascending: false })
      .order('match_date', { ascending: true })
      .order('match_time', { ascending: true });

    const { data, error } = await query;
    if (error) throw error;

    // Enrich with creator profile info
    if (data && data.length > 0) {
      // Get unique creator IDs from matches (we need to query the matches table for this)
      const matchIds = data.map(m => m.id);
      const { data: matchesWithCreators } = await supabase
        .from('matches')
        .select('id, creator_id')
        .in('id', matchIds);

      const creatorIds = Array.from(new Set((matchesWithCreators || []).map(m => m.creator_id).filter(Boolean)));
      let profilesMap = {};
      if (creatorIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, avatar_url')
          .in('id', creatorIds);
        profilesMap = (profiles || []).reduce((acc, p) => ({ ...acc, [p.id]: p }), {});
      }

      const creatorMap = {};
      if (matchesWithCreators) {
        matchesWithCreators.forEach(m => {
          const cid = m.creator_id;
          const profile = profilesMap[cid] || null;
          creatorMap[m.id] = {
            creator_id: cid,
            creator_name: profile?.name || 'Anónimo',
            creator_avatar: profile?.avatar_url,
          };
        });
      }

      // Check which matches current user has joined
      let joinedSet = new Set();
      if (currentUserId) {
        const { data: myJoins } = await supabase
          .from('match_players')
          .select('match_id')
          .eq('user_id', currentUserId);
        if (myJoins) {
          joinedSet = new Set(myJoins.map(j => j.match_id));
        }
      }

      // Check which matches current user has a pending join request
      let pendingSet = new Set();
      if (currentUserId) {
        const { data: myPending } = await supabase
          .from('match_join_requests')
          .select('match_id')
          .eq('user_id', currentUserId)
          .eq('status', 'pending');
        if (myPending) {
          pendingSet = new Set(myPending.map(p => p.match_id));
        }
      }

        data.forEach(m => {
        const info = creatorMap[m.id] || {};
        m.creator_id = info.creator_id;
        m.owner_id = info.creator_id || m.creator_id || null; // normalized owner id (creator)
        m.creator_name = info.creator_name || 'Anónimo';
        m.creator_avatar = info.creator_avatar;
        m.has_joined = joinedSet.has(m.id);
        m.has_requested = pendingSet.has(m.id);
      });
    }

    return data || [];
  },

  // Create match
  async create(matchData) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Debes iniciar sesión');

    const fullPayload = {
      creator_id: session.user.id,
      football_type: matchData.football_type,
      title: matchData.title || null,
      city: matchData.city || null,
      address: matchData.address || null,
      latitude: matchData.latitude || null,
      longitude: matchData.longitude || null,
      zone: matchData.zone || matchData.address || matchData.city || 'Sin zona',
      match_date: matchData.match_date,
      match_time: matchData.match_time,
      max_players: matchData.max_players,
      match_kind: matchData.match_kind || 'recreativo',
      visibility: matchData.visibility || 'public',
      requires_approval: typeof matchData.requires_approval === 'boolean' ? matchData.requires_approval : true,
      allow_waitlist: typeof matchData.allow_waitlist === 'boolean' ? matchData.allow_waitlist : true,
      price_per_player: matchData.price_per_player || 0,
      match_gender: matchData.match_gender || 'mixto',
      age_restricted: !!matchData.age_restricted,
      min_age: matchData.age_restricted ? (matchData.min_age ?? null) : null,
      max_age: matchData.age_restricted ? (matchData.max_age ?? null) : null,
      goalkeepers_needed: matchData.goalkeepers_needed != null ? parseInt(matchData.goalkeepers_needed) : 0,
      description: matchData.description || null,
    };

    let data;
    let error;
    ({ data, error } = await supabase.from('matches').insert(fullPayload).select().single());
    if (error) {
      const minimalPayload = {
        creator_id: session.user.id,
        football_type: matchData.football_type,
        city: matchData.city || null,
        address: matchData.address || null,
        zone: matchData.zone || matchData.address || matchData.city || 'Sin zona',
        match_date: matchData.match_date,
        match_time: matchData.match_time,
        max_players: matchData.max_players,
        description: matchData.description || null,
      };
      ({ data, error } = await supabase.from('matches').insert(minimalPayload).select().single());
      if (error) throw error;
    }

    // Creator auto-joins via RPC
    await supabase.rpc('join_match', { match_uuid: data.id });

    return data;
  },

  // Get pending join requests (for creator)
  async getJoinRequests(matchId) {
    const { data, error } = await supabase
      .from('match_join_requests')
      .select('*')
      .eq('match_id', matchId)
      .eq('status', 'pending');
    if (error) throw error;

    if (data && data.length > 0) {
      const userIds = Array.from(new Set(data.map(r => r.user_id).filter(Boolean)));
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, avatar_url')
          .in('id', userIds);
        const map = (profiles || []).reduce((acc, p) => ({ ...acc, [p.id]: p }), {});
        data.forEach(r => { r.profiles = map[r.user_id] || null; });
      }
    }

    return data || [];
  },

  // Attempt to find a join request related to a notification that lacks data
  // Strategy: find matches where creator_id == notif.user_id, then search recent join requests
  async findRequestForNotification(notif) {
    if (!notif || !notif.user_id || !notif.created_at) return null;
    // 3 minute window around notification time
    const notifTime = new Date(notif.created_at);
    const start = new Date(notifTime.getTime() - 3 * 60 * 1000).toISOString();
    const end = new Date(notifTime.getTime() + 3 * 60 * 1000).toISOString();

    // find matches where the notif recipient is the organizer/creator
    const { data: matchesData, error: mErr } = await supabase
      .from('matches')
      .select('id')
      .eq('creator_id', notif.user_id);
    if (mErr) throw mErr;
    if (!matchesData || matchesData.length === 0) return null;
    const matchIds = matchesData.map(m => m.id);

    const { data: reqs, error: rErr } = await supabase
      .from('match_join_requests')
      .select('*')
      .in('match_id', matchIds)
      .gte('created_at', start)
      .lte('created_at', end)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1);
    if (rErr) throw rErr;
    if (!reqs || reqs.length === 0) return null;
    const r = reqs[0];
    return { requestId: r.id, matchId: r.match_id, userId: r.user_id };
  },

  // Join match (request)
  async requestJoin(matchId) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Debes iniciar sesión');
    try {
      const { data, error } = await supabase.rpc('request_join_match', { 
        p_match_id: matchId, 
        p_user_id: session.user.id 
      });
      if (error) throw error;
      if (data && typeof data === 'object' && data.alreadyRequested) {
        return { ok: false, alreadyRequested: true };
      }
      if (data && typeof data === 'object' && data.blockedByAbandon) {
        return { ok: false, blockedByAbandon: true };
      }
      return { ok: true };
    } catch (err) {
      // RPC raises a descriptive error when a duplicate request exists
      const msg = err?.message || '';
      if (
        msg.toLowerCase().includes('join request already exists') ||
        msg.toLowerCase().includes('join request already') ||
        msg.toLowerCase().includes('duplicate key value') ||
        msg.toLowerCase().includes('match_join_requests_unique_pending')
      ) {
        return { ok: false, alreadyRequested: true };
      }
      if (msg.toLowerCase().includes('blockedbyabandon') || msg.toLowerCase().includes('aband')) {
        return { ok: false, blockedByAbandon: true };
      }
      throw err;
    }
  },

  // Approve join request
  async approveRequest(requestId, matchId, userId) {
    const { error } = await supabase.rpc('accept_match_request', {
      p_request_id: requestId,
      p_match_id: matchId,
      p_user_id: userId,
    });
    if (error) throw error;
  },

  // Reject join request
  async rejectRequest(requestId, matchId, userId) {
    const { error } = await supabase.rpc('reject_match_request', {
      p_request_id: requestId,
      p_match_id: matchId,
      p_user_id: userId,
    });
    if (error) throw error;
  },

  // Cancel a pending join request for the current user
  async cancelRequest(matchId) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Debes iniciar sesión');

    const { error } = await supabase
      .from('match_join_requests')
      .delete()
      .match({ match_id: matchId, user_id: session.user.id, status: 'pending' });
    if (error) throw error;
  },

  async getPlayers(matchId) {
    const { data, error } = await supabase
      .from('match_players')
      .select('*')
      .eq('match_id', matchId);
    if (error) throw error;

    if (data && data.length > 0) {
      const userIds = Array.from(new Set(data.map(p => p.user_id).filter(Boolean)));
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, avatar_url')
          .in('id', userIds);
        const map = (profiles || []).reduce((acc, p) => ({ ...acc, [p.id]: p }), {});
        data.forEach(r => { r.profiles = map[r.user_id] || null; });
      }
    }

    return data || [];
  },

  // Leave match (uses RPC function)
  async leave(matchId) {
    const { error } = await supabase.rpc('leave_match', { match_uuid: matchId });
    if (error) throw error;
  },

  // Delete a match (organizer or admin only). Calls RPC `delete_match` created on the DB.
  async deleteMatch(matchId) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Debes iniciar sesión');

    const { error } = await supabase.rpc('delete_match_secure', {
      p_match_id: matchId,
      p_requester_id: session.user.id,
    });
    if (error) throw error;
  },

  // ---- MATCH CHAT ----
  async getMessages(matchId) {
    const { data, error } = await supabase
      .from('match_messages')
      .select('*')
      .eq('match_id', matchId)
      .order('created_at', { ascending: true });
    if (error) throw error;

    if (data && data.length > 0) {
      const userIds = Array.from(new Set(data.map(m => m.user_id).filter(Boolean)));
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, avatar_url')
          .in('id', userIds);
        const map = (profiles || []).reduce((acc, p) => ({ ...acc, [p.id]: p }), {});
        data.forEach(m => { m.profiles = map[m.user_id] || null; });
      }
    }

    return data || [];
  },

  async sendMessage(matchId, message) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Debes iniciar sesión');

    const { data, error } = await supabase
      .from('match_messages')
      .insert({ match_id: matchId, user_id: session.user.id, message })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // Feature a match
  async feature(matchId, hours = 24) {
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
    const { error } = await supabase
      .from('featured_matches')
      .insert({ match_id: matchId, expires_at: expiresAt });
    if (error) throw error;
  },

  getSeArma(matches) {
    return (matches || []).filter((m) => {
      const joined = m.players_joined ?? m.current_players ?? 0;
      const max = m.max_players || 0;
      if (!max) return false;
      return max - joined <= 2 && joined < max;
    });
  },

  async confirmAttendance(matchId, status = 'confirmed') {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Debes iniciar sesión');

    const { data, error } = await supabase.rpc('confirm_match_attendance', {
      p_match_id: matchId,
      p_user_id: session.user.id,
      p_status: status,
    });
    if (error) throw error;
    return data;
  },

  async reviewPlayer(matchId, reviewedUserId, rating, comment = '') {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Debes iniciar sesión');

    const { data, error } = await supabase.rpc('review_player_after_match', {
      p_match_id: matchId,
      p_reviewer_id: session.user.id,
      p_reviewed_user_id: reviewedUserId,
      p_rating: rating,
      p_comment: comment || null,
    });
    if (error) throw error;
    return data;
  },
};

// ========== PROFILES ==========

export const profilesAPI = {
  async get(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (error) throw error;
    return data;
  },

  async getMatchesJoined(userId) {
    const { data, error } = await supabase
      .from('match_players')
      .select('match_id, joined_at, matches:match_id(id, football_type, zone, match_date, match_time, max_players)')
      .eq('user_id', userId)
      .order('joined_at', { ascending: false })
      .limit(20);
    if (error) throw error;
    return data || [];
  },

  async getMatchesCreated(userId) {
    const { data, error } = await supabase
      .from('matches')
      .select('id, football_type, zone, match_date, match_time, max_players')
      .eq('creator_id', userId)
      .order('match_date', { ascending: false })
      .limit(20);
    if (error) throw error;
    return data || [];
  },

  async getMatchesAbandoned(userId) {
    const { data, error } = await supabase
      .from('match_abandons')
      .select('match_id, abandoned_at, matches:match_id(id, football_type, zone, match_date, match_time, max_players)')
      .eq('user_id', userId)
      .order('abandoned_at', { ascending: false })
      .limit(20);
    if (error) throw error;
    return data || [];
  },

  async searchProfiles(term, currentUserId) {
    const trimmed = term?.trim() || '';
    let query = supabase
      .from('profiles')
      .select('id, name, avatar_url, city, zone, preferred_position, skill_level')
      .eq('is_profile_public', true)
      .order('name', { ascending: true })
      .limit(20);

    if (trimmed) {
      query = query.or(`name.ilike.%${trimmed}%,nickname.ilike.%${trimmed}%,city.ilike.%${trimmed}%,zone.ilike.%${trimmed}%`);
    }
    if (currentUserId) {
      query = query.neq('id', currentUserId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async updateMine(profileData) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Debes iniciar sesión');

    const birth = new Date(profileData.birth_date || '');
    const computedAge = Number.isNaN(birth.getTime())
      ? (profileData.age ? parseInt(profileData.age) : null)
      : Math.floor((Date.now() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000));

    const payload = {
      name: profileData.name,
      birth_date: profileData.birth_date || null,
      city: profileData.city || null,
      zone: profileData.zone || null,
      age: computedAge,
      gender: profileData.gender || null,
      preferred_position: profileData.preferred_position || null,
      preferred_foot: profileData.preferred_foot || null,
      skill_level: profileData.skill_level ? parseInt(profileData.skill_level) : null,
      bio: profileData.bio || null,
      phone: profileData.phone || null,
      is_profile_public: !!profileData.is_profile_public,
    };

    const { data, error } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', session.user.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async addContact(contactUserId) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Debes iniciar sesión');

    const { error } = await supabase
      .from('user_contacts')
      .upsert(
        [
          { user_id: session.user.id, contact_user_id: contactUserId },
          { user_id: contactUserId, contact_user_id: session.user.id },
        ],
        { onConflict: 'user_id,contact_user_id' }
      );
    if (error) throw error;
  },

  async getConversation(otherUserId) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Debes iniciar sesión');
    const me = session.user.id;

    const { data, error } = await supabase
      .from('direct_messages')
      .select('*')
      .or(`and(from_user_id.eq.${me},to_user_id.eq.${otherUserId}),and(from_user_id.eq.${otherUserId},to_user_id.eq.${me})`)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async sendDirectMessage(toUserId, message) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Debes iniciar sesión');

    const { data, error } = await supabase
      .from('direct_messages')
      .insert({
        from_user_id: session.user.id,
        to_user_id: toUserId,
        message,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};

// ========== VENUES ==========

export const venuesAPI = {
  async getAll(filters = {}) {
    let query = supabase
      .from('venues')
      .select('*, venue_slots(*)');

    if (filters.city) {
      query = query.eq('city', filters.city);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async create(venueData) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Debes iniciar sesión');

    const { data: myProfile } = await supabase
      .from('profiles')
      .select('profile_type')
      .eq('id', session.user.id)
      .maybeSingle();

    if (myProfile?.profile_type !== 'venue_member') {
      throw new Error('Solo perfiles miembro de canchas pueden agregar canchas');
    }

    const fullPayload = {
      owner_id: session.user.id,
      name: venueData.name,
      address: venueData.address || null,
      city: venueData.city || null,
      zone: venueData.zone || venueData.address || venueData.city || null,
      football_types: venueData.football_types || [],
      services: venueData.services || [],
      amenities: venueData.services || [],
    };

    let data;
    let error;
    ({ data, error } = await supabase.from('venues').insert(fullPayload).select().single());
    if (error) {
      const minimalPayload = {
        owner_id: session.user.id,
        name: venueData.name,
        address: venueData.address || null,
        city: venueData.city || null,
        zone: venueData.zone || venueData.address || venueData.city || null,
      };
      ({ data, error } = await supabase.from('venues').insert(minimalPayload).select().single());
      if (error) throw error;
    }
    return data;
  },
};

// ========== TOURNAMENTS ==========

export const tournamentsAPI = {
  async getAll(filters = {}) {
    let query = supabase
      .from('tournaments')
      .select('*')
      .order('start_date', { ascending: true });

    if (filters.football_type) {
      query = query.eq('football_type', parseInt(filters.football_type));
    }

    const { data, error } = await query;
    if (error) throw error;

    const rows = data || [];
    if (rows.length === 0) return [];

    const organizerIds = Array.from(new Set(rows.map((t) => t.organizer_id).filter(Boolean)));
    let profileMap = {};
    if (organizerIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', organizerIds);
      profileMap = (profiles || []).reduce((acc, p) => ({ ...acc, [p.id]: p }), {});
    }

    return rows.map((t) => ({
      ...t,
      organizer_name: profileMap[t.organizer_id]?.name || 'Anónimo',
      needed_players: t.needed_players ?? 1,
    }));
  },

  async create(tournamentData) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Debes iniciar sesión');

    const fullPayload = {
      organizer_id: session.user.id,
      name: tournamentData.name,
      football_type: parseInt(tournamentData.football_type),
      start_date: tournamentData.start_date,
      max_teams: tournamentData.max_teams || 2,
      entry_price: tournamentData.entry_price || 0,
      description: tournamentData.description || null,
      city: tournamentData.city || null,
      zone: tournamentData.zone || tournamentData.venue_name || tournamentData.city || null,
      venue_name: tournamentData.venue_name || null,
      needed_players: tournamentData.needed_players ? parseInt(tournamentData.needed_players) : 1,
      match_gender: tournamentData.match_gender || 'mixto',
      age_restricted: !!tournamentData.age_restricted,
      min_age: tournamentData.age_restricted ? (tournamentData.min_age ?? null) : null,
      max_age: tournamentData.age_restricted ? (tournamentData.max_age ?? null) : null,
      visibility: 'public',
    };

    let data;
    let error;
    ({ data, error } = await supabase.from('tournaments').insert(fullPayload).select().single());
    if (error) {
      const minimalPayload = {
        organizer_id: session.user.id,
        name: tournamentData.name,
        football_type: parseInt(tournamentData.football_type),
        start_date: tournamentData.start_date,
        max_teams: tournamentData.max_teams || 2,
        entry_price: tournamentData.entry_price || 0,
        description: tournamentData.description || null,
        city: tournamentData.city || null,
        zone: tournamentData.zone || tournamentData.venue_name || tournamentData.city || null,
        venue_name: tournamentData.venue_name || null,
      };
      ({ data, error } = await supabase.from('tournaments').insert(minimalPayload).select().single());
      if (error) throw error;
    }
    return data;
  },

  async applyRequest(tournamentId) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Debes iniciar sesión');

    const { error } = await supabase
      .from('tournament_player_requests')
      .upsert(
        { tournament_id: tournamentId, user_id: session.user.id, status: 'pending' },
        { onConflict: 'tournament_id,user_id' }
      );
    if (error) throw error;
  },

  async registerTeam(tournamentId, teamName) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Debes iniciar sesión');

    const { data, error } = await supabase
      .from('teams')
      .insert({
        tournament_id: tournamentId,
        name: teamName,
        captain_id: session.user.id,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};

// ========== SUBSCRIPTIONS ==========

export const subscriptionsAPI = {
  async getMine() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

    const { data, error } = await supabase
      .from('organizer_subscriptions')
      .select('*')
      .eq('user_id', session.user.id)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async subscribe(plan, price) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Debes iniciar sesión');

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('organizer_subscriptions')
      .insert({
        user_id: session.user.id,
        plan,
        price,
        expires_at: expiresAt,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};

// ========== NOTIFICATIONS ==========

export const notificationsAPI = {
  async getMine() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return [];

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });
    if (error) throw error;

    const rows = data || [];
    const keyOf = (n) => {
      const d = n?.data;
      if (!d || typeof d !== 'object') return null;
      return d.requestId || d.request_id || null;
    };

    const bestByRequest = new Map();
    for (const n of rows) {
      const reqId = keyOf(n);
      if (!reqId) continue;
      const prev = bestByRequest.get(reqId);
      const score = /ten[eé]s una nueva solicitud de/i.test(String(n.message || '')) ? 2 : 1;
      const prevScore = prev ? (/ten[eé]s una nueva solicitud de/i.test(String(prev.message || '')) ? 2 : 1) : -1;
      if (!prev || score > prevScore) {
        bestByRequest.set(reqId, n);
      }
    }

    return rows.filter((n) => {
      const reqId = keyOf(n);
      if (!reqId) return true;
      return bestByRequest.get(reqId)?.id === n.id;
    });
  },

  async markAsRead(notificationId) {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);
    if (error) throw error;
  },

  async markHandled(notificationId) {
    const { error } = await supabase
      .from('notifications')
      .update({ handled: true, is_read: true })
      .eq('id', notificationId);
    if (error) throw error;
  },

  // Update notification.data column
  async updateNotificationData(notificationId, dataObj) {
    const { error } = await supabase
      .from('notifications')
      .update({ data: dataObj })
      .eq('id', notificationId);
    if (error) throw error;
  },

  async markAllAsRead() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', session.user.id)
      .eq('is_read', false);
    if (error) throw error;
  },

  async create(userId, type, message, data) {
    const { error } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        type,
        message,
        data,
      });
    if (error) console.error('Error creating notification:', error);
  }
};

// ========== CLUBS ==========

export const clubsAPI = {
  async getAll() {
    const { data, error } = await supabase
      .from('clubs')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async getById(id) {
    const { data, error } = await supabase
      .from('clubs')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async create(clubData) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Debes iniciar sesión');

    const { data, error } = await supabase
      .from('clubs')
      .insert({
        ...clubData,
        creator_id: session.user.id
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getMembers(clubId) {
    const { data, error } = await supabase
      .from('club_members')
      .select('*')
      .eq('club_id', clubId);
    if (error) throw error;

    if (data && data.length > 0) {
      const userIds = Array.from(new Set(data.map(m => m.user_id).filter(Boolean)));
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, avatar_url')
          .in('id', userIds);
        const map = (profiles || []).reduce((acc, p) => ({ ...acc, [p.id]: p }), {});
        data.forEach(r => { r.profiles = map[r.user_id] || null; });
      }
    }

    return data || [];
  },

  async joinClub(clubId, role = 'member') {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Debes iniciar sesión');

    const { error } = await supabase
      .from('club_members')
      .insert({ club_id: clubId, user_id: session.user.id, role });
    if (error) throw error;
  },

  async getRecruitments(clubId = null) {
    let query = supabase
      .from('club_recruitments')
      .select('*, clubs:club_id(name, city)')
      .eq('status', 'open')
      .order('created_at', { ascending: false });

    if (clubId) {
      query = query.eq('club_id', clubId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async createRecruitment(recruitmentData) {
    const { error } = await supabase
      .from('club_recruitments')
      .insert(recruitmentData);
    if (error) throw error;
  }
};

// ========== FIELDS ==========

export const fieldsAPI = {
  async getAll(city = null) {
    let query = supabase
      .from('fields')
      .select('*')
      .order('is_featured', { ascending: false })
      .order('name', { ascending: true });

    if (city) {
      query = query.eq('city', city);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async getSlots(fieldId) {
    const { data, error } = await supabase
      .from('field_slots')
      .select('*')
      .eq('field_id', fieldId)
      .order('date', { ascending: true })
      .order('start_time', { ascending: true });
    if (error) throw error;
    return data || [];
  }
};

// ========== SUPPORT & REPORT ==========

export const supportAPI = {
  async createTicket(subject, message) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Debes iniciar sesión');

    const { error } = await supabase
      .from('support_tickets')
      .insert({
        user_id: session.user.id,
        subject,
        message,
        status: 'open'
      });
    if (error) throw error;
  }
};

export const reportsAPI = {
  async reportUser(reportedUserId, reason, details) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Debes iniciar sesión');

    const { error } = await supabase
      .from('user_reports')
      .insert({
        reporter_id: session.user.id,
        reported_user_id: reportedUserId,
        reason,
        details,
        status: 'pending'
      });
    if (error) throw error;
  }
};

// ========== USER TEAMS ==========

export const userTeamsAPI = {
  async getAll(filters = {}) {
    let query = supabase
      .from('user_teams')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters.zone && filters.zone !== 'Todas') {
      query = query.eq('zone', filters.zone);
    }
    if (filters.football_type) {
      query = query.eq('football_type', parseInt(filters.football_type));
    }
    if (filters.is_recruiting) {
      query = query.eq('is_recruiting', true);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async create(teamData) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Debes iniciar sesión');

    const payload = {
      name: teamData.name,
      city: teamData.city || null,
      zone: teamData.zone || null,
      football_type: teamData.football_type ? parseInt(teamData.football_type) : null,
      description: teamData.description || null,
      is_public: teamData.is_public !== false,
      is_recruiting: !!teamData.is_recruiting,
      captain_id: session.user.id,
    };

    const { data, error } = await supabase
      .from('user_teams')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;

    await supabase
      .from('user_team_members')
      .upsert({
        team_id: data.id,
        user_id: session.user.id,
        role: 'captain',
        status: 'active',
      }, { onConflict: 'team_id,user_id' });

    return data;
  },

  async requestJoin(teamId, message = '') {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Debes iniciar sesión');

    const { data, error } = await supabase
      .from('user_team_join_requests')
      .insert({
        team_id: teamId,
        user_id: session.user.id,
        message: message || null,
        status: 'pending',
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};
