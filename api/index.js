// api/index.js (Full Corrected Code)

const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const serverless = require('serverless-http'); 

// --- Supabase Setup (using Environment Variables) ---
// NOTE: Using the SERVICE_ROLE_KEY for server-side security
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; 
const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    }
});

const app = express();
app.use(express.json()); 

// --- CORS Setup ---
// The origin should be your frontend Vercel domain
const allowedOrigin = process.env.CORS_ORIGIN || 'https://park-my-car.vercel.app';
app.use(cors({ 
    origin: allowedOrigin,
    methods: ['GET', 'POST', 'OPTIONS'],
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


// POST to book a spot - CONSOLIDATED AND CORRECTED ROUTE
// This handler combines the two previous POST attempts into one secure, working route.
app.post('/api/book-spot/:id', async (req, res) => {
  const spotId = parseInt(req.params.id, 10);
  const { duration_hours } = req.body; 

  // 1. INPUT VALIDATION
  if (isNaN(spotId)) {
    return res.status(400).json({ success: false, message: 'Invalid Spot ID format.' });
  }
  if (!duration_hours || duration_hours <= 0) {
    return res.status(400).json({ success: false, message: 'Invalid booking duration.' });
  }

  // 2. AUTHENTICATION (Verifies user is logged in)
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ success: false, message: 'Unauthorized: No token provided.' });
  }

  // Use service client to verify the user token
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  
  if (userError || !user) {
    console.error('Token validation failed:', userError?.message);
    return res.status(401).json({ success: false, message: 'Unauthorized: Invalid or expired token.' });
  }

  // 3. CHECK SPOT & BOOKING LOGIC
  const { data: spot, error: fetchError } = await supabase
    .from('parking_spots')
    .select('*')
    .eq('id', spotId)
    .single();
  
  if (fetchError || !spot) {
    return res.status(404).json({ success: false, message: 'Spot not found.' });
  }

  // Check availability based on booked_until time
  if (spot.booked_until && new Date(spot.booked_until) > new Date()) {
    return res.status(400).json({ success: false, message: 'Spot is currently unavailable.' });
  }
  
  // 4. CALCULATE & UPDATE
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
    console.error('Database update error:', updateError);
    return res.status(500).json({ success: false, message: 'Failed to book spot due to server error.' });
  }

  // 5. SUCCESS RESPONSE
  res.json({ success: true, spot: updatedSpot });
});


// Add a default Express 404 handler at the end of all routes
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route not found for: ${req.method} ${req.originalUrl}` });
});

// Wrap the Express app instance with the serverless-http handler
module.exports.handler = serverless(app);