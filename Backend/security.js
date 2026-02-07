const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const authMiddleware = require('./middleware/auth.js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Get security company profile
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    if (req.user.type !== 'security') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { data: company, error } = await supabase
      .from('security_companies')
      .select('*')
      .eq('id', req.user.id)
      .single();

    if (error || !company) {
      return res.status(404).json({ error: 'Security company not found' });
    }

    delete company.password_hash;
    res.json(company);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update security company profile
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    if (req.user.type !== 'security') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { company_name, phone_number, address, latitude, longitude, coverage_radius_km, is_available } = req.body;

    const updateData = {};
    if (company_name) updateData.company_name = company_name;
    if (phone_number) updateData.phone_number = phone_number;
    if (address !== undefined) updateData.address = address;
    if (latitude !== undefined) updateData.latitude = latitude;
    if (longitude !== undefined) updateData.longitude = longitude;
    if (coverage_radius_km !== undefined) updateData.coverage_radius_km = coverage_radius_km;
    if (is_available !== undefined) updateData.is_available = is_available;

    const { data: company, error } = await supabase
      .from('security_companies')
      .update(updateData)
      .eq('id', req.user.id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    delete company.password_hash;
    res.json(company);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get alerts for security company
router.get('/alerts', authMiddleware, async (req, res) => {
  try {
    if (req.user.type !== 'security') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { status } = req.query;

    let query = supabase
      .from('alerts')
      .select('*')
      .eq('security_company_id', req.user.id)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data: alerts, error } = await query;

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json(alerts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Toggle availability
router.patch('/availability', authMiddleware, async (req, res) => {
  try {
    if (req.user.type !== 'security') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { is_available } = req.body;

    if (typeof is_available !== 'boolean') {
      return res.status(400).json({ error: 'is_available must be a boolean' });
    }

    const { data: company, error } = await supabase
      .from('security_companies')
      .update({ is_available })
      .eq('id', req.user.id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    delete company.password_hash;
    res.json(company);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;