import { Router } from 'express';
import pool from '../config/db.js';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';

const router = Router();

// Get all matches (featured first, filter by area)
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { area, date, football_type } = req.query;
    let query = `
      SELECT m.*, u.name as organizer_name, u.avatar_url as organizer_avatar,
        CASE WHEN fm.id IS NOT NULL AND fm.end_time > NOW() AND fm.is_active THEN true ELSE false END as is_featured
      FROM matches m
      JOIN users u ON m.organizer_id = u.id
      LEFT JOIN featured_matches fm ON m.id = fm.match_id
      WHERE 1=1
    `;
    const params = [];

    if (area && area !== 'Todas') {
      params.push(area);
      query += ` AND m.area = $${params.length}`;
    }
    if (date) {
      params.push(date);
      query += ` AND m.match_date = $${params.length}`;
    }
    if (football_type) {
      params.push(parseInt(football_type));
      query += ` AND m.football_type = $${params.length}`;
    }

    query += ` ORDER BY is_featured DESC, m.match_date ASC, m.match_time ASC`;

    const result = await pool.query(query, params);

    // If user is authenticated, check which matches they've joined
    if (req.user) {
      const joinedResult = await pool.query(
        'SELECT match_id FROM match_players WHERE user_id = $1',
        [req.user.id]
      );
      const joinedIds = new Set(joinedResult.rows.map(r => r.match_id));
      result.rows.forEach(m => { m.has_joined = joinedIds.has(m.id); });
    }

    res.json(result.rows);
  } catch (err) {
    console.error('Get matches error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single match
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT m.*, u.name as organizer_name, u.avatar_url as organizer_avatar,
        CASE WHEN fm.id IS NOT NULL AND fm.end_time > NOW() AND fm.is_active THEN true ELSE false END as is_featured
      FROM matches m
      JOIN users u ON m.organizer_id = u.id
      LEFT JOIN featured_matches fm ON m.id = fm.match_id
      WHERE m.id = $1
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Match not found' });
    }

    const match = result.rows[0];

    // Get players
    const playersResult = await pool.query(`
      SELECT u.id, u.name, u.avatar_url FROM match_players mp
      JOIN users u ON mp.user_id = u.id
      WHERE mp.match_id = $1
    `, [req.params.id]);

    match.players = playersResult.rows;

    if (req.user) {
      match.has_joined = match.players.some(p => p.id === req.user.id);
    }

    res.json(match);
  } catch (err) {
    console.error('Get match error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create match
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { football_type, location, area, match_date, match_time, max_players, description } = req.body;

    if (!football_type || !location || !area || !match_date || !match_time || !max_players) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await pool.query(
      `INSERT INTO matches (organizer_id, football_type, location, area, match_date, match_time, max_players, description, current_players)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1) RETURNING *`,
      [req.user.id, football_type, location, area, match_date, match_time, max_players, description]
    );

    const match = result.rows[0];

    // Organizer auto-joins
    await pool.query('INSERT INTO match_players (match_id, user_id) VALUES ($1, $2)', [match.id, req.user.id]);

    res.status(201).json(match);
  } catch (err) {
    console.error('Create match error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Join match
router.post('/:id/join', authenticateToken, async (req, res) => {
  try {
    const matchId = req.params.id;

    const matchResult = await pool.query('SELECT * FROM matches WHERE id = $1', [matchId]);
    if (matchResult.rows.length === 0) {
      return res.status(404).json({ error: 'Match not found' });
    }

    const match = matchResult.rows[0];
    if (match.is_full) {
      return res.status(400).json({ error: 'Match is full' });
    }

    // Check if already joined
    const existingJoin = await pool.query(
      'SELECT id FROM match_players WHERE match_id = $1 AND user_id = $2',
      [matchId, req.user.id]
    );
    if (existingJoin.rows.length > 0) {
      return res.status(400).json({ error: 'Already joined this match' });
    }

    await pool.query('INSERT INTO match_players (match_id, user_id) VALUES ($1, $2)', [matchId, req.user.id]);

    const newCount = match.current_players + 1;
    const isFull = newCount >= match.max_players;

    await pool.query(
      'UPDATE matches SET current_players = $1, is_full = $2 WHERE id = $3',
      [newCount, isFull, matchId]
    );

    res.json({ message: 'Joined match successfully', current_players: newCount, is_full: isFull });
  } catch (err) {
    console.error('Join match error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Leave match
router.delete('/:id/leave', authenticateToken, async (req, res) => {
  try {
    const matchId = req.params.id;

    const result = await pool.query(
      'DELETE FROM match_players WHERE match_id = $1 AND user_id = $2 RETURNING id',
      [matchId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Not joined to this match' });
    }

    await pool.query(
      'UPDATE matches SET current_players = current_players - 1, is_full = false WHERE id = $1',
      [matchId]
    );

    res.json({ message: 'Left match successfully' });
  } catch (err) {
    console.error('Leave match error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Feature a match
router.post('/:id/feature', authenticateToken, async (req, res) => {
  try {
    const matchId = req.params.id;
    const { hours = 24 } = req.body;

    const matchResult = await pool.query('SELECT * FROM matches WHERE id = $1 AND organizer_id = $2', [matchId, req.user.id]);
    if (matchResult.rows.length === 0) {
      return res.status(404).json({ error: 'Match not found or unauthorized' });
    }

    const settingsResult = await pool.query("SELECT value FROM app_settings WHERE key = 'featured_price'");
    const price = settingsResult.rows.length > 0 ? parseFloat(settingsResult.rows[0].value) : 500;

    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + hours * 60 * 60 * 1000);

    await pool.query(
      'INSERT INTO featured_matches (match_id, start_time, end_time, payment_amount) VALUES ($1, $2, $3, $4)',
      [matchId, startTime, endTime, price]
    );

    res.json({ message: 'Match featured successfully', price, end_time: endTime });
  } catch (err) {
    console.error('Feature match error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
