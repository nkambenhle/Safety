const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');
const { Expo } = require('expo-server-sdk');
const authMiddleware = require('../middleware/auth.js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const expo = new Expo();
const upload = multer({ storage: multer.memoryStorage() });

// Calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

// Find nearest available security company
async function findNearestSecurityCompany(latitude, longitude, excludeIds = []) {
  const { data: companies, error } = await supabase
    .from('security_companies')
    .select('*')
    .eq('is_available', true)
    .not('latitude', 'is', null)
    .not('longitude', 'is', null);

  if (error || !companies || companies.length === 0) {
    return null;
  }

  // Filter out excluded companies and calculate distances
  const companiesWithDistance = companies
    .filter(company => !excludeIds.includes(company.id))
    .map(company => ({
      ...company,
      distance: calculateDistance(latitude, longitude, company.latitude, company.longitude)
    }))
    .sort((a, b) => a.distance - b.distance);

  return companiesWithDistance.length > 0 ? companiesWithDistance[0] : null;
}

// Send push notification to security company
async function sendPushNotification(expoPushToken, alert) {
  if (!Expo.isExpoPushToken(expoPushToken)) {
    console.error('Invalid Expo push token:', expoPushToken);
    return;
  }

  const message = {
    to: expoPushToken,
    sound: 'default',
    title: '🚨 Emergency Alert',
    body: `New alert from ${alert.user_name}`,
    data: { alertId: alert.id },
    priority: 'high',
  };

  try {
    const ticket = await expo.sendPushNotificationsAsync([message]);
    console.log('Push notification sent:', ticket);
  } catch (error) {
    console.error('Error sending push notification:', error);
  }
}

// Create alert
router.post('/', authMiddleware, upload.single('audio'), async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    const userId = req.user.id;

    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Missing location data' });
    }

    // Get user details
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Find nearest security company
    const nearestCompany = await findNearestSecurityCompany(parseFloat(latitude), parseFloat(longitude));

    if (!nearestCompany) {
      return res.status(503).json({ error: 'No available security companies in your area' });
    }

    let audioUrl = null;

    // Upload audio file if provided
    if (req.file) {
      const fileName = `${userId}_${Date.now()}.m4a`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('alert-recordings')
        .upload(fileName, req.file.buffer, {
          contentType: 'audio/m4a',
          upsert: false
        });

      if (uploadError) {
        console.error('Error uploading audio:', uploadError);
      } else {
        const { data: urlData } = supabase.storage
          .from('alert-recordings')
          .getPublicUrl(fileName);
        audioUrl = urlData.publicUrl;
      }
    }

    // Create alert
    const { data: alert, error: alertError } = await supabase
      .from('alerts')
      .insert([{
        user_id: userId,
        security_company_id: nearestCompany.id,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        audio_url: audioUrl,
        user_phone: user.phone_number,
        user_name: user.full_name,
        status: 'pending'
      }])
      .select()
      .single();

    if (alertError) {
      return res.status(400).json({ error: alertError.message });
    }

    // Log routing history
    await supabase
      .from('alert_routing_history')
      .insert([{
        alert_id: alert.id,
        security_company_id: nearestCompany.id,
        notified_at: new Date().toISOString()
      }]);

    // Send push notification (if expo token exists - implement token storage separately)
    // await sendPushNotification(nearestCompany.expo_push_token, alert);

    res.status(201).json({
      alert,
      message: 'Alert sent successfully',
      security_company: {
        name: nearestCompany.company_name,
        distance: nearestCompany.distance.toFixed(2) + ' km'
      }
    });

    // Set up timeout for fallback routing (run in background)
    setTimeout(async () => {
      await checkAndRouteToNextCompany(alert.id);
    }, (process.env.ALERT_TIMEOUT_MINUTES || 3) * 60 * 1000);

  } catch (error) {
    console.error('Error creating alert:', error);
    res.status(500).json({ error: error.message });
  }
});

// Check if alert needs to be routed to next company
async function checkAndRouteToNextCompany(alertId, attempt = 0) {
  const maxAttempts = process.env.MAX_FALLBACK_ATTEMPTS || 3;

  if (attempt >= maxAttempts) {
    console.log(`Max fallback attempts reached for alert ${alertId}`);
    return;
  }

  const { data: alert, error } = await supabase
    .from('alerts')
    .select('*')
    .eq('id', alertId)
    .single();

  if (error || !alert) {
    console.error('Error fetching alert:', error);
    return;
  }

  // If alert is still pending, route to next company
  if (alert.status === 'pending') {
    const { data: routingHistory } = await supabase
      .from('alert_routing_history')
      .select('security_company_id')
      .eq('alert_id', alertId);

    const excludeIds = routingHistory ? routingHistory.map(r => r.security_company_id) : [];

    const nextCompany = await findNearestSecurityCompany(alert.latitude, alert.longitude, excludeIds);

    if (nextCompany) {
      await supabase
        .from('alerts')
        .update({ security_company_id: nextCompany.id })
        .eq('id', alertId);

      await supabase
        .from('alert_routing_history')
        .insert([{
          alert_id: alertId,
          security_company_id: nextCompany.id,
          notified_at: new Date().toISOString()
        }]);

      // await sendPushNotification(nextCompany.expo_push_token, alert);

      // Set up next timeout
      setTimeout(async () => {
        await checkAndRouteToNextCompany(alertId, attempt + 1);
      }, (process.env.ALERT_TIMEOUT_MINUTES || 3) * 60 * 1000);
    }
  }
}

// Get alert by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const { data: alert, error } = await supabase
      .from('alerts')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    // Check authorization
    if (req.user.type === 'user' && alert.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (req.user.type === 'security' && alert.security_company_id !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    res.json(alert);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user's alert history
router.get('/user/history', authMiddleware, async (req, res) => {
  try {
    if (req.user.type !== 'user') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { data: alerts, error } = await supabase
      .from('alerts')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json(alerts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update alert status (for security companies)
router.patch('/:id/status', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (req.user.type !== 'security') {
      return res.status(403).json({ error: 'Only security companies can update alert status' });
    }

    if (!['pending', 'dispatched', 'resolved', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const updateData = { status };
    if (status === 'dispatched') {
      updateData.dispatched_at = new Date().toISOString();
    } else if (status === 'resolved') {
      updateData.resolved_at = new Date().toISOString();
    }

    const { data: alert, error } = await supabase
      .from('alerts')
      .update(updateData)
      .eq('id', id)
      .eq('security_company_id', req.user.id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Update routing history
    if (status === 'dispatched') {
      await supabase
        .from('alert_routing_history')
        .update({ responded: true, responded_at: new Date().toISOString() })
        .eq('alert_id', id)
        .eq('security_company_id', req.user.id);
    }

    res.json(alert);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;