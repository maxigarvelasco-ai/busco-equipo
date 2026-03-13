import { Router } from 'express';
import pool from '../config/db.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = Router();

// Get active venues
router.get('/', async (req, res) => {
  try {
    const { area } = req.query;
    let query = 'SELECT * FROM venues WHERE is_active = true';
    const params = [];

    if (area && area !== 'Todas') {
      params.push(area);
      query += ` AND area = $${params.length}`;
    }

    query += ' ORDER BY created_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Get venues error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create venue (admin)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, location, area, description, football_types, subscription_tier, monthly_price, contact, phone } = req.body;

    const result = await pool.query(
      `INSERT INTO venues (owner_id, name, location, area, description, football_types, subscription_tier, monthly_price, contact, phone)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [req.user.id, name, location, area, description, football_types, subscription_tier, monthly_price, contact, phone]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create venue error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update venue
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, location, area, description, football_types, subscription_tier, monthly_price, contact, phone, is_active } = req.body;

    const result = await pool.query(
      `UPDATE venues SET name = $1, location = $2, area = $3, description = $4, football_types = $5,
       subscription_tier = $6, monthly_price = $7, contact = $8, phone = $9, is_active = $10
       WHERE id = $11 RETURNING *`,
      [name, location, area, description, football_types, subscription_tier, monthly_price, contact, phone, is_active, req.params.id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Venue not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update venue error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete venue
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM venues WHERE id = $1', [req.params.id]);
    res.json({ message: 'Venue deleted' });
  } catch (err) {
    console.error('Delete venue error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
