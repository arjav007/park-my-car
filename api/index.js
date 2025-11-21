// api/index.js

const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const serverless = require('serverless-http'); 

// --- Supabase Setup (using Environment Variables) ---
// NOTE: Use a Service Role Key for secure server-side operations
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; 
const supabase = createClient(supabaseUrl, supabaseKey);

const app = express();
app.use(express.json()); // Allows reading JSON from the request body

// --- CORS Setup ---
// Use process.env.CORS_ORIGIN or fall back to a specific Vercel URL for security
const allowedOrigin = process.env.CORS_ORIGIN || 'https://park-my-car.vercel.app';
app.use(cors({ 
    origin: allowedOrigin,
    methods: ['GET', 'POST', 'OPTIONS'], // Ensure OPTIONS is allowed for preflight
    allowedHeaders: ['Content-Type', 'Authorization']
}));

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
// This route now uses the token for authentication (the secure method).
app.post('/api/book-spot/:id', async (req, res) => {
  const spotId = parseInt(req.params.id, 10);
  const { duration_hours } = req.body; // Duration is expected in the body

  // 1. Input Validation
  if (isNaN(spotId)) {
    return res.status(400).json({ success: false, message: 'Invalid Spot ID format.' });
  }
  if (!duration_hours || duration_hours <= 0) {
    return res.status(400).json({ success: false, message: 'Invalid booking duration.' });
  }

  // 2. Authentication (CRITICAL for security)
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ success: false, message: 'Unauthorized: No token provided.' });
  }

  // Use the service role key client to verify the user token
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  
  if (userError || !user) {
    console.error('Token validation failed:', userError?.message);
    return res.status(401).json({ success: false, message: 'Unauthorized: Invalid or expired token.' });
  }

  // 3. Check Spot Availability
  const { data: spot, error: fetchError } = await supabase
    .from('parking_spots')
    .select('*')
    .eq('id', spotId)
    .single();
  
  if (fetchError || !spot) {
    return res.status(404).json({ success: false, message: 'Spot not found.' });
  }

  if (spot.booked_until && new Date(spot.booked_until) > new Date()) {
    // Spot is currently booked
    return res.status(400).json({ success: false, message: 'Spot is currently unavailable.' });
  }
  
  // 4. Calculate Booking End Time
  const bookedUntil = new Date(Date.now() + duration_hours * 60 * 60 * 1000);

  // 5. Update Database
  const { data: updatedSpot, error: updateError } = await supabase
    .from('parking_spots')
    .update({ 
      // Update logic based on your schema
      is_available: false, 
      booked_by_user_id: user.id, // Use the ID from the validated token
      booked_until: bookedUntil.toISOString()
    })
    .eq('id', spotId)
    .select()
    .single();

  if (updateError) {
    console.error('Database update error:', updateError);
    return res.status(500).json({ success: false, message: 'Failed to book spot due to server error.' });
  }

  res.json({ success: true, spot: updatedSpot });
});

// Final handler for serverless environment
module.exports.handler = serverless(app);