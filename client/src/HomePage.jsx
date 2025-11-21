// client/src/HomePage.jsx

import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { supabase } from './supabaseClient';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

// --- Reusable Components ---

function BookingModal({ spot, onClose, onConfirm, isLoading }) { 
  const [duration, setDuration] = useState(1);
  const price = ((spot.booking_price || 50) * duration).toFixed(2);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-[2000] p-4"
      >
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 50, opacity: 0 }}
          className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-sm"
        >
          <h2 className="text-3xl font-extrabold mb-3 text-gray-900 text-center">Book Spot: {spot.name}</h2>
          <p className="mb-6 text-gray-600 text-center text-sm">Hourly Rate: ₹{spot.booking_price || 50}</p>
          
          <div className="flex justify-center space-x-2 mb-6">
            {[1, 2, 3, 4].map(hours => (
              <button
                key={hours}
                onClick={() => setDuration(hours)}
                className={`px-4 py-2 rounded-full border-2 font-semibold transition-all duration-200 ease-in-out text-sm
                  ${duration === hours
                    ? 'bg-purple-600 text-white border-purple-600 shadow-md'
                    : 'bg-white text-gray-700 hover:bg-purple-50 hover:border-purple-200'
                  }`}
              >
                {hours} hr
              </button>
            ))}
          </div>
          <div className="text-center text-3xl font-extrabold mb-6 text-purple-700">
            Total: ₹{price}
          </div>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => onConfirm(duration)}
              disabled={isLoading}
              className="w-full px-6 py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition-colors shadow-lg disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-5 w-5 mr-3 text-white" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Booking...
                </>
              ) : 'Confirm Booking'}
            </button>
            <button onClick={onClose} className="w-full px-6 py-3 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300 transition-colors">Cancel</button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function MapController({ spot, center }) {
  const map = useMap();
  useEffect(() => {
    if (spot) {
      map.flyTo([spot.lat, spot.lng], 16, { animate: true, duration: 1 });
    } else if (center) {
      map.flyTo(center, 14, { animate: true, duration: 1 });
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 768);
  const [isBookingLoading, setIsBookingLoading] = useState(false);
  const activeMarkerRef = useRef(null);

  // Reusable function to fetch the latest spot data
  const fetchSpots = async () => {
    const { data, error } = await supabase.from('parking_spots').select('*').order('id');
    if (error) {
      setError("Could not fetch parking spots. Please try again later.");
      console.error("Error fetching spots:", error);
      return [];
    } else if (data) {
      setSpots(data);
      return data;
    }
    return [];
  };
  
  useEffect(() => {
    setLoading(true);
    fetchSpots().finally(() => setLoading(false));

    const channel = supabase
      .channel('parking-spots-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'parking_spots' },
        (payload) => {
          setSpots(prevSpots =>
            prevSpots.map(spot => 
              spot.id === payload.new.id ? payload.new : spot
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (spotToBook && activeMarkerRef.current) {
      activeMarkerRef.current.closePopup();
    }
  }, [spotToBook]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsSidebarOpen(true);
      } else {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);


  const handleFindNearMe = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser.");
      return;
    }
    toast.loading("Finding your location...", { id: "location" });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setMapCenter([latitude, longitude]);
        toast.success("Found your location!", { id: "location" });
      },
      (err) => {
        console.error("Geolocation error:", err);
        let errorMessage = "Could not get your location.";
        if (err.code === err.PERMISSION_DENIED) {
          errorMessage += " Please enable location services in your browser settings.";
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          errorMessage += " Location information is unavailable.";
        } else if (err.code === err.TIMEOUT) {
          errorMessage += " The request to get user location timed out.";
        }
        toast.error(errorMessage, { id: "location" });
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  };

  const handleBooking = async (duration_hours) => {
    if (!session?.access_token) {
      toast.error("You need to be logged in to book a spot.");
      setSpotToBook(null);
      return;
    }
    
    setIsBookingLoading(true);
    const bookingToastId = toast.loading('Booking spot...');

    try {
      // ✅ CRITICAL FIX: Ensure VITE_API_URL ends with a slash and the path starts without one.
      const baseUrl = import.meta.env.VITE_API_URL || '';
      const baseApiUrl = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/'; // Ensure base URL ends with '/'
      
      const response = await fetch(`${baseApiUrl}api/book-spot/${spotToBook.id}`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${session.access_token}`, 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ duration_hours })
      });

      // Handle non-200 responses (401, 404, 500)
      if (!response.ok) {
        let errorData = await response.text(); 
        
        // This helps catch the Express 404 handler sending HTML
        if (response.status === 404 && errorData.startsWith('<!DOCTYPE html>')) {
             throw new Error("404: API endpoint not found. Please check your AWS route configuration.");
        }
        
        try {
            // Try parsing as JSON for the custom error message
            errorData = JSON.parse(errorData);
        } catch (e) {
            // If not JSON, use the raw status text
            throw new Error(`Booking failed (${response.status} ${response.statusText}): ${errorData}`);
        }
        
        throw new Error(errorData.message || errorData.error || 'Booking failed.');
      }
      
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || 'Booking failed.');
      }

      toast.success('Spot booked successfully!', { id: bookingToastId });
      setSpotToBook(null);

    } catch (err) {
      toast.error(err.message || 'Booking failed. Please check the console for details.', { id: bookingToastId });
      console.error("Booking handler error:", err);
    } finally {
      setIsBookingLoading(false);
    }
  };
  
  // --- Icon Definitions ---
  const createCustomIcon = (color) => new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
  });

  const availableIcon = createCustomIcon('green');
  const occupiedIcon = createCustomIcon('red');
  const selectedIcon = createCustomIcon('blue');

  if (loading) return <div className="flex justify-center items-center h-screen bg-gray-50"><p className="text-xl text-gray-700 animate-pulse">Loading Parking Map...</p></div>;
  if (error) return <div className="flex justify-center items-center h-screen bg-red-50"><p className="text-xl text-red-700">{error}</p></div>;

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">
      {/* --- Responsive Sidebar --- */}
      <motion.div
        initial={false}
        animate={{ x: isSidebarOpen ? '0%' : '-100%' }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className={`absolute md:relative z-[900] w-80 max-w-[80vw] h-full p-4 bg-white shadow-xl overflow-y-auto ${isSidebarOpen ? '' : ''} md:translate-x-0`}
      >
        <div className="flex justify-between items-center mb-6 border-b pb-4">
            <h2 className="text-3xl font-extrabold text-purple-700">Park My Car</h2>
            <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-1 text-gray-500 hover:text-gray-800 rounded-full hover:bg-gray-100 transition-colors">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
        </div>
        <button onClick={handleFindNearMe} className="w-full my-4 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-md text-lg flex items-center justify-center space-x-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
          <span>Find Parking Near Me</span>
        </button>
        <div className="space-y-4">
          {spots.length === 0 ? (
            <p className="text-center text-gray-500 mt-8">No parking spots found.</p>
          ) : (
            spots.map((spot) => (
              <div
                key={spot.id}
                onClick={() => { setSelectedSpot(spot); setIsSidebarOpen(false); }}
                className={`p-4 rounded-xl cursor-pointer transition-all duration-200 ease-in-out flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2
                  ${(spot.booked_until && new Date(spot.booked_until) > new Date()) 
                    ? 'bg-gray-50 border border-gray-200 text-gray-500 cursor-not-allowed'
                    : 'bg-white border border-green-200 hover:bg-green-50 shadow-sm'
                  } 
                  ${selectedSpot?.id === spot.id ? 'bg-blue-50 ring-2 ring-blue-400 border-blue-300 shadow-md' : ''}`}
              >
                <div className="flex-grow">
                  <h3 className="font-bold text-lg text-gray-800">{spot.name}</h3>
                  <p className="text-sm text-gray-600">ID: {spot.id}</p>
                </div>
                <div className="flex-shrink-0">
                  <span className={`text-sm font-bold px-3 py-1 rounded-full 
                    ${(spot.booked_until && new Date(spot.booked_until) > new Date()) ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                    {(spot.booked_until && new Date(spot.booked_until) > new Date()) ? 'Occupied' : 'Available'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </motion.div>
      
      {/* --- Map Container --- */}
      <div className="flex-1 relative">
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="md:hidden absolute top-4 left-4 z-[800] p-2 bg-white rounded-full shadow-lg text-gray-800 hover:bg-gray-100 transition-colors">
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
        </button>

        <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%', zIndex: 1 }} className="rounded-l-lg shadow-inner">
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap contributors' />
          {spots.map((spot) => {
            const isAvailable = !(spot.booked_until && new Date(spot.booked_until) > new Date());
            return (
            <Marker 
              key={spot.id} 
              position={[spot.lat, spot.lng]} 
              icon={selectedSpot?.id === spot.id ? selectedIcon : (isAvailable ? availableIcon : occupiedIcon)}
              eventHandlers={{ click: () => setSelectedSpot(spot) }}
              ref={selectedSpot?.id === spot.id ? activeMarkerRef : null}
            >
              <Popup>
                <div className="text-center font-sans">
                  <h3 className="font-bold text-xl mb-1 text-gray-900">{spot.name}</h3>
                  <p className="text-sm text-gray-600 mb-2">ID: {spot.id}</p>
                  <p className={`font-semibold mb-3 px-3 py-1 rounded-full inline-block text-sm
                    ${isAvailable ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {isAvailable ? 'Available' : 'Occupied'}
                  </p>
                  {isAvailable && (
                    <button 
                      onClick={() => setSpotToBook(spot)} 
                      className="w-full px-5 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-md text-base"
                    >
                      Book Now
                    </button>
                  )}
                </div>
              </Popup>
            </Marker>
          )})}
          <MapController spot={selectedSpot} center={mapCenter} />
        </MapContainer>
      </div>
      
      {spotToBook && <BookingModal spot={spotToBook} onClose={() => setSpotToBook(null)} onConfirm={handleBooking} isLoading={isBookingLoading} />}
    </div>
  );
}