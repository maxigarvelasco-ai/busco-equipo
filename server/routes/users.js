import { Router } from 'express';
import pool from '../config/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// Get user profile
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, role, subscription_type, avatar_url, rating, matches_played, created_at FROM users WHERE id = $1',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    // Get matches joined
    const matchesJoined = await pool.query(`
      SELECT m.id, m.football_type, m.location, m.area, m.match_date, m.match_time, m.current_players, m.max_players
      FROM match_players mp JOIN matches m ON mp.match_id = m.id
      WHERE mp.user_id = $1 ORDER BY m.match_date DESC LIMIT 20
    `, [req.params.id]);

    // Get matches created
    const matchesCreated = await pool.query(`
      SELECT id, football_type, location, area, match_date, match_time, current_players, max_players
      FROM matches WHERE organizer_id = $1 ORDER BY match_date DESC LIMIT 20
    `, [req.params.id]);

    // Get tournaments
    const tournaments = await pool.query(`
      SELECT t.id, t.name, t.football_type, t.tournament_date, t.entry_price
      FROM teams te JOIN tournaments t ON te.tournament_id = t.id
      WHERE te.captain_id = $1 ORDER BY t.tournament_date DESC LIMIT 10
    `, [req.params.id]);

    user.matches_joined = matchesJoined.rows;
    user.matches_created = matchesCreated.rows;
    user.tournaments = tournaments.rows;

    res.json(user);
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { name, avatar_url } = req.body;

    const result = await pool.query(
      'UPDATE users SET name = COALESCE($1, name), avatar_url = COALESCE($2, avatar_url) WHERE id = $3 RETURNING id, name, email, role, subscription_type, avatar_url',
      [name, avatar_url, req.user.id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Subscribe to Pro
router.post('/subscribe', authenticateToken, async (req, res) => {
  try {
    const settingsResult = await pool.query("SELECT value FROM app_settings WHERE key = 'pro_monthly_price'");
    const price = settingsResult.rows.length > 0 ? parseFloat(settingsResult.rows[0].value) : 2000;

    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);

    await pool.query(
      'INSERT INTO subscriptions (user_id, plan_type, price, start_date, end_date) VALUES ($1, $2, $3, $4, $5)',
      [req.user.id, 'pro', price, startDate, endDate]
    );

    await pool.query("UPDATE users SET subscription_type = 'pro' WHERE id = $1", [req.user.id]);

    res.json({ message: 'Subscribed to Pro successfully', price, end_date: endDate });
  } catch (err) {
    console.error('Subscribe error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
