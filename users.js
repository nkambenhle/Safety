const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const authMiddleware = require('./middleware/auth.js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Get user profile
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    if (req.user.type !== 'user') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, full_name, phone_number, address, emergency_contact_name, emergency_contact_phone, created_at')
      .eq('id', req.user.id)
      .single();

    if (error || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update user profile
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    if (req.user.type !== 'user') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { full_name, phone_number, address, emergency_contact_name, emergency_contact_phone } = req.body;

    const updateData = {};
    if (full_name) updateData.full_name = full_name;
    if (phone_number) updateData.phone_number = phone_number;
    if (address !== undefined) updateData.address = address;
    if (emergency_contact_name !== undefined) updateData.emergency_contact_name = emergency_contact_name;
    if (emergency_contact_phone !== undefined) updateData.emergency_contact_phone = emergency_contact_phone;

    const { data: user, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', req.user.id)
      .select('id, email, full_name, phone_number, address, emergency_contact_name, emergency_contact_phone')
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;