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
        .select('id, creator_id, profiles:creator_id(name, avatar_url)')
        .in('id', matchIds);

      const creatorMap = {};
      if (matchesWithCreators) {
        matchesWithCreators.forEach(m => {
          creatorMap[m.id] = {
            creator_id: m.creator_id,
            creator_name: m.profiles?.name || 'Anónimo',
            creator_avatar: m.profiles?.avatar_url,
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

      data.forEach(m => {
        const info = creatorMap[m.id] || {};
        m.creator_id = info.creator_id;
        m.creator_name = info.creator_name || 'Anónimo';
        m.creator_avatar = info.creator_avatar;
        m.has_joined = joinedSet.has(m.id);
      });
    }

    return data || [];
  },

  // Create match
  async create(matchData) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Debes iniciar sesión');

    const { data, error } = await supabase
      .from('matches')
      .insert({
        creator_id: session.user.id,
        football_type: matchData.football_type,
        city: matchData.city || null,
        address: matchData.address || null,
        latitude: matchData.latitude || null,
        longitude: matchData.longitude || null,
        zone: matchData.zone,
        match_date: matchData.match_date,
        match_time: matchData.match_time,
        max_players: matchData.max_players,
        description: matchData.description || null,
      })
      .select()
      .single();

    if (error) throw error;

    // Creator auto-joins via RPC
    await supabase.rpc('join_match', { match_uuid: data.id });

    return data;
  },

  // Get pending join requests (for creator)
  async getJoinRequests(matchId) {
    const { data, error } = await supabase
      .from('match_join_requests')
      .select('*, profiles:user_id(name, avatar_url, ranking)')
      .eq('match_id', matchId)
      .eq('status', 'pending');
    if (error) throw error;
    return data || [];
  },

  // Join match (request)
  async requestJoin(matchId) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Debes iniciar sesión');

    const { error } = await supabase
      .from('match_join_requests')
      .insert({ match_id: matchId, user_id: session.user.id, status: 'pending' });
    
    if (error) throw error;
  },

  // Approve join request
  async approveRequest(requestId, matchId, userId) {
    // 1. Update request status
    const { error: updateError } = await supabase
      .from('match_join_requests')
      .update({ status: 'approved' })
      .eq('id', requestId);
    if (updateError) throw updateError;

    // 2. Add player to match
    const { error: joinError } = await supabase
      .from('match_players')
      .insert({ match_id: matchId, user_id: userId });
    if (joinError) throw joinError;

    // 3. Create Notification
    await notificationsAPI.create(userId, 'join_request_approved', `Tu solicitud para unirte al partido ha sido aceptada.`, `/match/${matchId}`);
  },

  // Reject join request
  async rejectRequest(requestId, matchId, userId) {
    const { error } = await supabase
      .from('match_join_requests')
      .update({ status: 'rejected' })
      .eq('id', requestId);
    if (error) throw error;

    // Create Notification
    await notificationsAPI.create(userId, 'join_request_rejected', `Tu solicitud para unirte al partido ha sido rechazada.`, `/match/${matchId}`);
  },

  // Leave match (uses RPC function)
  async leave(matchId) {
    const { error } = await supabase.rpc('leave_match', { match_uuid: matchId });
    if (error) throw error;
  },

  // ---- MATCH CHAT ----
  async getMessages(matchId) {
    const { data, error } = await supabase
      .from('match_messages')
      .select('*, profiles:user_id(name, avatar_url)')
      .eq('match_id', matchId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async sendMessage(matchId, message) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Debes iniciar sesión');

    const { error } = await supabase
      .from('match_messages')
      .insert({ match_id: matchId, user_id: session.user.id, message });
    if (error) throw error;
  },

  // Feature a match
  async feature(matchId, hours = 24) {
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
    const { error } = await supabase
      .from('featured_matches')
      .insert({ match_id: matchId, expires_at: expiresAt });
    if (error) throw error;
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
};

// ========== VENUES ==========

export const venuesAPI = {
  async getAll(filters = {}) {
    let query = supabase
      .from('venues')
      .select('*, venue_slots(*)');

    if (filters.zone && filters.zone !== 'Todas') {
      query = query.eq('zone', filters.zone);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async create(venueData) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Debes iniciar sesión');

    const { data, error } = await supabase
      .from('venues')
      .insert({ ...venueData, owner_id: session.user.id })
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};

// ========== TOURNAMENTS ==========

export const tournamentsAPI = {
  async getAll() {
    const { data, error } = await supabase
      .from('tournaments')
      .select('*, profiles:organizer_id(name), teams(id)')
      .order('start_date', { ascending: true });
    if (error) throw error;

    return (data || []).map(t => ({
      ...t,
      organizer_name: t.profiles?.name || 'Anónimo',
      teams_registered: t.teams?.length || 0,
    }));
  },

  async create(tournamentData) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Debes iniciar sesión');

    const { data, error } = await supabase
      .from('tournaments')
      .insert({ ...tournamentData, organizer_id: session.user.id })
      .select()
      .single();
    if (error) throw error;
    return data;
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
    return data || [];
  },

  async markAsRead(notificationId) {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
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

  async create(userId, type, content, data) {
    const { error } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        type,
        content,
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
      .select('*, profiles:creator_id(name)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async getById(id) {
    const { data, error } = await supabase
      .from('clubs')
      .select('*, profiles:creator_id(name)')
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
      .select('*, profiles:user_id(name, avatar_url)')
      .eq('club_id', clubId);
    if (error) throw error;
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
