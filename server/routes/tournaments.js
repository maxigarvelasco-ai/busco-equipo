import { Router } from 'express';
import pool from '../config/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// Get all tournaments
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT t.*, u.name as organizer_name,
        (SELECT COUNT(*) FROM teams WHERE tournament_id = t.id) as teams_registered
      FROM tournaments t
      JOIN users u ON t.organizer_id = u.id
      ORDER BY t.tournament_date ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Get tournaments error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create tournament (pro only)
router.post('/', authenticateToken, async (req, res) => {
  try {
    // Check if user is pro
    const userResult = await pool.query('SELECT subscription_type FROM users WHERE id = $1', [req.user.id]);
    if (userResult.rows[0]?.subscription_type !== 'pro') {
      return res.status(403).json({ error: 'Pro subscription required to create tournaments' });
    }

    const { name, football_type, tournament_date, teams_limit, entry_price, description } = req.body;

    const result = await pool.query(
      `INSERT INTO tournaments (organizer_id, name, football_type, tournament_date, teams_limit, entry_price, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [req.user.id, name, football_type, tournament_date, teams_limit, entry_price || 0, description]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create tournament error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Register team
router.post('/:id/register', authenticateToken, async (req, res) => {
  try {
    const tournamentId = req.params.id;
    const { team_name } = req.body;

    const tournament = await pool.query('SELECT * FROM tournaments WHERE id = $1', [tournamentId]);
    if (tournament.rows.length === 0) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    const teamsCount = await pool.query('SELECT COUNT(*) FROM teams WHERE tournament_id = $1', [tournamentId]);
    if (parseInt(teamsCount.rows[0].count) >= tournament.rows[0].teams_limit) {
      return res.status(400).json({ error: 'Tournament is full' });
    }

    const result = await pool.query(
      'INSERT INTO teams (tournament_id, name, captain_id) VALUES ($1, $2, $3) RETURNING *',
      [tournamentId, team_name, req.user.id]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Register team error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
