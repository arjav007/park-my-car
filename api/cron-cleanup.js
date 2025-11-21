const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async (req, res) => {
  const cronSecret = process.env.CRON_SECRET;
  const providedSecret = req.headers['authorization'];

  if (!cronSecret || providedSecret !== cronSecret) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const nowIso = new Date().toISOString();

  // TODO: Replace this fallback with a real expiration filter if/when `expiration_time` exists.
  const { data: bookedSpots, error: fetchError } = await supabase
    .from('parking_spots')
    .select('*')
    .eq('status', 'Booked');
    // .lt('expiration_time', nowIso); // Uncomment when column is available

  if (fetchError) {
    return res.status(500).json({ success: false, message: fetchError.message });
  }

  if (!bookedSpots || bookedSpots.length === 0) {
    return res.status(200).json({ success: true, message: 'No booked spots to clean.' });
  }

  const spotIds = bookedSpots.map((spot) => spot.id);

  const { error: updateError } = await supabase
    .from('parking_spots')
    .update({
      booked_by: null,
      status: 'Available',
    })
    .in('id', spotIds);

  if (updateError) {
    return res.status(500).json({ success: false, message: updateError.message });
  }

  return res.status(200).json({
    success: true,
    message: `Cleared ${spotIds.length} booked spots at ${nowIso}.`,
  });
};

