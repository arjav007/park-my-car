// client/src/HomePage.jsx

import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { supabase } from './supabaseClient';
import toast from 'react-hot-toast';

// --- Reusable Components (no changes needed) ---

function BookingModal({ spot, onClose, onConfirm }) {
  const [duration, setDuration] = useState(1);
  const price = ((spot.booking_price || 50) * duration).toFixed(2);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-[2000]">
      <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-sm m-4">
        <h2 className="text-2xl font-bold mb-2 text-gray-800">Book Spot: {spot.name}</h2>
        <p className="mb-6 text-gray-600">Select your booking duration.</p>
        <div className="flex justify-center space-x-2 mb-6">
          {[1, 2, 3, 4].map(hours => (
            <button key={hours} onClick={() => setDuration(hours)} className={`px-4 py-2 rounded-lg border-2 font-semibold transition-colors ${duration === hours ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-700 hover:bg-purple-50'}`}>
              {hours} hr
            </button>
          ))}
        </div>
        <div className="text-center text-2xl font-bold mb-6 text-gray-900">Total: ₹{price}</div>
        <div className="flex justify-between gap-4">
          <button onClick={onClose} className="w-full px-6 py-3 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300 transition-colors">Cancel</button>
          <button onClick={() => onConfirm(duration)} className="w-full px-6 py-3 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 transition-colors">Confirm</button>
        </div>
      </div>
    </div>
  );
}

function MapController({ spot, center }) {
  const map = useMap();
  useEffect(() => {
    if (spot) {
      map.flyTo([spot.lat, spot.lng], 16);
    } else if (center) {
      map.flyTo(center, 14);
    }
  }, [spot, center, map]);
  return null;
}

// --- Main HomePage Component ---

export default function HomePage({ session }) {
  const [spots, setSpots] = useState([]);
  const [selectedSpot, setSelectedSpot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [spotToBook, setSpotToBook] = useState(null);
  const [mapCenter, setMapCenter] = useState([19.0760, 72.8777]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const activeMarkerRef = useRef(null);

  // Reusable function to fetch the latest spot data
  const fetchSpots = async () => {
    const { data, error } = await supabase.from('parking_spots').select('*').order('id');
    if (error) {
      setError("Could not fetch parking spots. Please try again later.");
      console.error("Error fetching spots:", error);
    } else if (data) {
      setSpots(data);
    }
  };
  
  // This useEffect handles fetching data AND listening for real-time updates
  useEffect(() => {
    setLoading(true);
    fetchSpots().finally(() => setLoading(false));

    // ✅ ADDED: Subscribe to real-time database changes
    const channel = supabase
      .channel('parking-spots-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'parking_spots' },
        (payload) => {
          // When a change is received, refetch the data to update the UI
          fetchSpots();
        }
      )
      .subscribe();

    // Cleanup function to unsubscribe when the component unmounts
    return () => {
      supabase.removeChannel(channel);
    };
  }, []); // Note: The empty dependency array [] means this runs only once on mount.

  // ✅ FIXED: This useEffect was previously nested incorrectly. It's now separate.
  // This hook handles closing the marker popup when the booking modal is opened.
  useEffect(() => {
    if (spotToBook && activeMarkerRef.current) {
      activeMarkerRef.current.closePopup();
    }
  }, [spotToBook]);

  const handleFindNearMe = () => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setMapCenter([latitude, longitude]);
        toast.success("Found your location!");
      },
      () => {
        toast.error("Could not get your location. Please enable location services.");
      }
    );
  };

  const handleBooking = async (duration_hours) => {
    setSpotToBook(null);
    const bookingToast = toast.loading('Booking spot...');

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/book-spot/${spotToBook.id}`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${session.access_token}`, 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ duration_hours })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Booking failed.');
      }

      toast.success('Spot booked successfully!', { id: bookingToast });
      // Note: You don't strictly need the fetchSpots() call here anymore
      // because the Supabase listener will catch the update, but it doesn't hurt.
      
    } catch (err) {
      toast.error(err.message || 'Booking failed. The spot may have been taken.', { id: bookingToast });
    }
  };
  
  // --- Icon Definitions ---
  const availableIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
  });
  const occupiedIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
  });

  if (loading) return <div className="flex justify-center items-center h-full"><p className="text-lg animate-pulse">Loading Map...</p></div>;
  if (error) return <div className="flex justify-center items-center h-full"><p className="text-lg text-red-600">{error}</p></div>;

  return (
    <div className="flex h-full">
      {/* --- Responsive Sidebar --- */}
      <div className={`absolute md:relative z-[900] w-80 h-full p-4 bg-white shadow-lg overflow-y-auto transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-800">Parking Spots</h2>
            <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-1 text-gray-500 hover:text-gray-800">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
        </div>
        <button onClick={handleFindNearMe} className="w-full my-4 py-2.5 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 transition-colors shadow">
          Find Parking Near Me
        </button>
        <div className="space-y-3">
          {spots.map((spot) => (
            <div
              key={spot.id}
              onClick={() => { setSelectedSpot(spot); setIsSidebarOpen(false); }}
              className={`p-4 rounded-lg cursor-pointer transition-all flex items-center justify-between ${
                spot.is_available ? 'hover:bg-green-50' : 'opacity-60 bg-gray-100 cursor-not-allowed'
              } ${selectedSpot?.id === spot.id ? 'bg-blue-100 ring-2 ring-blue-500' : 'border'}`}
            >
              <h3 className="font-semibold text-gray-800">{spot.name}</h3>
              <span className={`text-xs font-bold px-2 py-1 rounded-full ${spot.is_available ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {spot.is_available ? 'Available' : 'Booked'}
              </span>
            </div>
          ))}
        </div>
      </div>
      
      {/* --- Map Container --- */}
      <div className="flex-1 relative">
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="md:hidden absolute top-4 left-4 z-[800] p-2 bg-white rounded-full shadow-lg text-gray-800">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
        </button>

        <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap contributors' />
          {spots.map((spot) => (
            <Marker 
              key={spot.id} 
              position={[spot.lat, spot.lng]} 
              icon={spot.is_available ? availableIcon : occupiedIcon}
              ref={selectedSpot?.id === spot.id ? activeMarkerRef : null}
            >
              <Popup>
                <div className="text-center">
                  <h3 className="font-bold text-lg mb-1">{spot.name}</h3>
                  <p className={`font-semibold mb-2 ${spot.is_available ? 'text-green-600' : 'text-red-600'}`}>
                    {spot.is_available ? 'Available' : 'Occupied'}
                  </p>
                  {spot.is_available && (
                    <button onClick={() => setSpotToBook(spot)} className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                      Book Now
                    </button>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
          <MapController spot={selectedSpot} center={mapCenter} />
        </MapContainer>
      </div>
      
      {spotToBook && <BookingModal spot={spotToBook} onClose={() => setSpotToBook(null)} onConfirm={handleBooking} />}
    </div>
  );
}