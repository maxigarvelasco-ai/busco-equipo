import { Router } from 'express';
import pool from '../config/db.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = Router();

// Get dashboard metrics
router.get('/metrics', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [users, matches, venues, tournaments, subscriptions, featured] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM users'),
      pool.query('SELECT COUNT(*) FROM matches'),
      pool.query('SELECT COUNT(*) FROM venues WHERE is_active = true'),
      pool.query('SELECT COUNT(*) FROM tournaments'),
      pool.query('SELECT COUNT(*) FROM subscriptions WHERE is_active = true'),
      pool.query('SELECT COUNT(*) FROM featured_matches WHERE is_active = true AND end_time > NOW()'),
    ]);

    const revenueResult = await pool.query(`
      SELECT
        COALESCE((SELECT SUM(payment_amount) FROM featured_matches), 0) as featured_revenue,
        COALESCE((SELECT SUM(price) FROM subscriptions), 0) as subscription_revenue,
        COALESCE((SELECT SUM(monthly_price) FROM venues WHERE is_active = true), 0) as venue_revenue
    `);

    res.json({
      total_users: parseInt(users.rows[0].count),
      total_matches: parseInt(matches.rows[0].count),
      active_venues: parseInt(venues.rows[0].count),
      total_tournaments: parseInt(tournaments.rows[0].count),
      active_subscriptions: parseInt(subscriptions.rows[0].count),
      active_featured: parseInt(featured.rows[0].count),
      revenue: revenueResult.rows[0],
    });
  } catch (err) {
    console.error('Get metrics error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get/Update settings
router.get('/settings', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT key, value FROM app_settings');
    const settings = {};
    result.rows.forEach(r => { settings[r.key] = r.value; });
    res.json(settings);
  } catch (err) {
    console.error('Get settings error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/settings', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const settings = req.body;
    for (const [key, value] of Object.entries(settings)) {
      await pool.query(
        'INSERT INTO app_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()',
        [key, value.toString()]
      );
    }
    res.json({ message: 'Settings updated' });
  } catch (err) {
    console.error('Update settings error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete match (admin)
router.delete('/matches/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM matches WHERE id = $1', [req.params.id]);
    res.json({ message: 'Match deleted' });
  } catch (err) {
    console.error('Delete match error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all subscriptions
router.get('/subscriptions', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.*, u.name as user_name, u.email as user_email
      FROM subscriptions s JOIN users u ON s.user_id = u.id
      ORDER BY s.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Get subscriptions error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all users (admin)
router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, role, subscription_type, matches_played, created_at FROM users ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
