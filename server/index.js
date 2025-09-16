const express = require('express');
const http = require('http');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config(); // Allows reading from .env file for local development

// --- Supabase Setup (using Environment Variables) ---
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const app = express();
app.use(express.json()); // 👈 Added to parse JSON from the request body

// --- CORS Setup (using Environment Variable) ---
const clientUrl = process.env.CLIENT_URL;
app.use(cors({ origin: clientUrl }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: clientUrl, // 👈 Also use environment variable here
    methods: ["GET", "POST"]
  },

});

const PORT = 3001;

// --- API Routes ---

// GET all parking spots from the database
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

// POST to book a parking spot for a specific duration
app.post('/api/book-spot/:id', async (req, res) => {
  const spotId = parseInt(req.params.id, 10);
  const { duration_hours } = req.body; // 👈 Get duration from request body

  if (!duration_hours || duration_hours <= 0) {
    return res.status(400).json({ success: false, message: 'Invalid booking duration provided.' });
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

  // 👈 Calculate the expiry time
  const bookedUntil = new Date(Date.now() + duration_hours * 60 * 60 * 1000);

  const { data: updatedSpot, error: updateError } = await supabase
    .from('parking_spots')
    .update({ 
      is_available: false, 
      booked_by_user_id: user.id,
      booked_until: bookedUntil.toISOString() // 👈 Save the expiry time
    })
    .eq('id', spotId)
    .select()
    .single();

  if (updateError) {
    return res.status(500).json({ success: false, message: 'Failed to book spot.' });
  }

  // Announce the update to all connected clients
  const { data: allSpots } = await supabase.from('parking_spots').select('*').order('id');
  io.emit('spots-update', allSpots);

  res.json({ success: true, spot: updatedSpot });
});




// --- Automated Spot Release Job ---
// This function runs periodically to check for and free up expired bookings
const checkExpiredBookings = async () => {
  console.log('Checking for expired bookings...');
  const { data, error } = await supabase
    .from('parking_spots')
    .update({ is_available: true, booked_by_user_id: null, booked_until: null })
    .lt('booked_until', new Date().toISOString()) // Finds spots where the expiry time is in the past
    .neq('is_available', true) // Only updates spots that are currently marked as booked
    .select();
  
  if (error) {
    console.error('Error checking expired bookings:', error);
  } else if (data && data.length > 0) {
    console.log(`Freed ${data.length} expired spots.`);
    // If spots were freed, announce the update to all clients
    const { data: allSpots } = await supabase.from('parking_spots').select('*').order('id');
    io.emit('spots-update', allSpots);
  }
};

// 👈 Run the check every minute (60,000 milliseconds)
setInterval(checkExpiredBookings, 60000);

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});