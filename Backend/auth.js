const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Register user
router.post('/register/user', async (req, res) => {
  try {
    const { email, password, full_name, phone_number, address, emergency_contact_name, emergency_contact_phone } = req.body;

    // Validate required fields
    if (!email || !password || !full_name || !phone_number) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Insert user
    const { data, error } = await supabase
      .from('users')
      .insert([{
        email,
        password_hash,
        full_name,
        phone_number,
        address,
        emergency_contact_name,
        emergency_contact_phone
      }])
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: data.id, type: 'user', email: data.email },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.status(201).json({
      user: {
        id: data.id,
        email: data.email,
        full_name: data.full_name,
        phone_number: data.phone_number
      },
      token
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Register security company
router.post('/register/security', async (req, res) => {
  try {
    const { email, password, company_name, phone_number, address, latitude, longitude, coverage_radius_km } = req.body;

    if (!email || !password || !company_name || !phone_number || !latitude || !longitude) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const { data, error } = await supabase
      .from('security_companies')
      .insert([{
        email,
        password_hash,
        company_name,
        phone_number,
        address,
        latitude,
        longitude,
        coverage_radius_km: coverage_radius_km || 10.0
      }])
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const token = jwt.sign(
      { id: data.id, type: 'security', email: data.email },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.status(201).json({
      security_company: {
        id: data.id,
        email: data.email,
        company_name: data.company_name,
        phone_number: data.phone_number
      },
      token
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password, type } = req.body;

    if (!email || !password || !type) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const table = type === 'user' ? 'users' : 'security_companies';

    // Get user/security company
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('email', email)
      .single();

    if (error || !data) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const valid = await bcrypt.compare(password, data.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: data.id, type, email: data.email },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    // Remove password from response
    delete data.password_hash;

    res.json({ [type]: data, token });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;