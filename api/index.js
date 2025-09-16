// In api/index.js

const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

// --- Supabase Setup (using Environment Variables) ---
// Make sure these are set in your Vercel project settings
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const app = express();
app.use(express.json()); // Allows reading JSON from the request body

// --- CORS Setup (using Environment Variable) ---
const clientUrl = process.env.VITE_APP_URL; // Use your frontend URL variable
app.use(cors({ origin: clientUrl }));

// --- API Routes ---

// GET all parking spots
app.get('/api/parking-spots', async (req, res) => {
  const { data, error } = await supabase
    .from('parking_spots')
    .select('*')
    .order('id');

  if (error) {
    console.error('Error fetching spots:', error);
    return res.status(500).json({ error: error.message });
  }
  res.json(data);
});

// POST to book a spot
app.post('/api/book-spot/:id', async (req, res) => {
  const spotId = parseInt(req.params.id, 10);
  const { duration_hours } = req.body;

  if (!duration_hours || duration_hours <= 0) {
    return res.status(400).json({ success: false, message: 'Invalid booking duration.' });
  }

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ success: false, message: 'Unauthorized: No token provided.' });
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) {
    return res.status(401).json({ success: false, message: 'Unauthorized: Invalid token.' });
  }

  const { data: spot, error: fetchError } = await supabase
    .from('parking_spots')
    .select('*')
    .eq('id', spotId)
    .single();
  
  if (fetchError || !spot) {
    return res.status(404).json({ success: false, message: 'Spot not found.' });
  }

  if (!spot.is_available) {
    return res.status(400).json({ success: false, message: 'Spot is already booked.' });
  }

  const bookedUntil = new Date(Date.now() + duration_hours * 60 * 60 * 1000);

  const { data: updatedSpot, error: updateError } = await supabase
    .from('parking_spots')
    .update({ 
      is_available: false, 
      booked_by_user_id: user.id,
      booked_until: bookedUntil.toISOString()
    })
    .eq('id', spotId)
    .select()
    .single();

  if (updateError) {
    return res.status(500).json({ success: false, message: 'Failed to book spot.' });
  }

  // ⛔ We removed io.emit(). The database update will automatically trigger
  // the real-time listener on your frontend.

  res.json({ success: true, spot: updatedSpot });
});

// ✅ This is the crucial change for Vercel
// Export the Express app instance to be used by Vercel's serverless runtime
module.exports = app;