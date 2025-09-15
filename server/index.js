// server/index.js

const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

// --- Supabase Setup ---
const supabaseUrl = 'https://osrlezlnimaknoxowswe.supabase.co'; // 👈 Paste your URL here
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9zcmxlemxuaW1ha25veG93c3dlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Nzk1MjM1MywiZXhwIjoyMDczNTI4MzUzfQ.498roqTasoBPOPFf_JN3izKsSYuk-KiWZFRmN3yd49A'; // 👈 Paste your Key here
const supabase = createClient(supabaseUrl, supabaseKey);

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
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

// POST to book a parking spot
// In server/index.js

app.post('/api/book-spot/:id', async (req, res) => {
  const spotId = parseInt(req.params.id, 10);

  // 1. Get the user's token from the request header
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Unauthorized: No token provided.' });
  }

  // 2. Verify the token with Supabase
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);

  if (userError || !user) {
    return res.status(401).json({ success: false, message: 'Unauthorized: Invalid token.' });
  }

  // 3. Proceed with booking logic ONLY if the user is valid
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

  // 4. Update the spot and save the user's ID
  const { data: updatedSpot, error: updateError } = await supabase
    .from('parking_spots')
    .update({ 
      is_available: false, 
      booked_by_user_id: user.id // Track who booked it
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

io.on('connection', (socket) => {
  console.log('A user connected');
  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});