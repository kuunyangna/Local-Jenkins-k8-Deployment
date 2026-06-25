const express = require('express');
const { query } = require('../db/pool');

const router = express.Router();

// GET /api/enrollments - list all enrollments with student & class names
router.get('/', async (req, res) => {
  try {
    const result = await query(`
      SELECT e.id, e.enrolled_at,
             s.id AS student_id, s.first_name AS student_first_name, s.last_name AS student_last_name,
             c.id AS class_id, c.name AS class_name
      FROM enrollments e
      JOIN students s ON s.id = e.student_id
      JOIN classes c ON c.id = e.class_id
      ORDER BY e.enrolled_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch enrollments' });
  }
});

// POST /api/enrollments - enroll a student in a class
router.post('/', async (req, res) => {
  const { student_id, class_id } = req.body;

  if (!student_id || !class_id) {
    return res
      .status(400)
      .json({ error: 'student_id and class_id are required' });
  }

  try {
    const result = await query(
      `INSERT INTO enrollments (student_id, class_id)
       VALUES ($1, $2)
       RETURNING *`,
      [student_id, class_id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res
        .status(409)
        .json({ error: 'Student is already enrolled in this class' });
    }
    if (err.code === '23503') {
      return res
        .status(400)
        .json({ error: 'student_id or class_id does not exist' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to create enrollment' });
  }
});

// DELETE /api/enrollments/:id - unenroll
router.delete('/:id', async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM enrollments WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Enrollment not found' });
    }
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete enrollment' });
  }
});

module.exports = router;
