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
        .select('id, creator_id, profiles_creator:creator_id(name, avatar_url)')
        .in('id', matchIds);

      const creatorMap = {};
      if (matchesWithCreators) {
        matchesWithCreators.forEach(m => {
          const cid = m.creator_id;
          const profile = (m.profiles_creator && m.profiles_creator.length && m.profiles_creator[0]) || null;
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
      .select('*')
      .eq('match_id', matchId)
      .eq('status', 'pending');
    if (error) throw error;

    if (data && data.length > 0) {
      const userIds = Array.from(new Set(data.map(r => r.user_id).filter(Boolean)));
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, avatar_url, ranking')
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
      const { error } = await supabase.rpc('request_join_match', { 
        p_match_id: matchId, 
        p_user_id: session.user.id 
      });
      if (error) throw error;
      return { ok: true };
    } catch (err) {
      // RPC raises a descriptive error when a duplicate request exists
      const msg = err?.message || '';
      if (msg.toLowerCase().includes('join request already exists') || msg.toLowerCase().includes('join request already')) {
        return { ok: false, alreadyRequested: true };
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
          .select('id, name, avatar_url, ranking')
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

    const { error } = await supabase.rpc('delete_match', { p_match_id: matchId, p_requester_id: session.user.id });
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
