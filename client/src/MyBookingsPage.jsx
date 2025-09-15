import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { Link } from 'react-router-dom';

// --- Polished Countdown Timer Component ---
function Countdown({ expiry }) {
  const calculateTimeLeft = () => {
    const difference = +new Date(expiry) - +new Date();
    let timeLeft = {};

    if (difference > 0) {
      timeLeft = {
        hours: Math.floor(difference / (1000 * 60 * 60)),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60),
      };
    }
    return timeLeft;
  };

  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());

  useEffect(() => {
    const timer = setTimeout(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);
    return () => clearTimeout(timer);
  });

  // Function to add a leading zero if the number is less than 10
  const addLeadingZero = (value) => (value < 10 ? `0${value}` : value);

  if (!timeLeft.hours && !timeLeft.minutes && !timeLeft.seconds) {
    return <span className="text-red-500">Expired</span>;
  }

  return (
    <div className="flex space-x-2 text-center">
      <div>
        <span className="font-bold text-2xl">{addLeadingZero(timeLeft.hours)}</span>
        <span className="text-xs block">Hours</span>
      </div>
      <span className="font-bold text-2xl">:</span>
      <div>
        <span className="font-bold text-2xl">{addLeadingZero(timeLeft.minutes)}</span>
        <span className="text-xs block">Mins</span>
      </div>
      <span className="font-bold text-2xl">:</span>
      <div>
        <span className="font-bold text-2xl">{addLeadingZero(timeLeft.seconds)}</span>
        <span className="text-xs block">Secs</span>
      </div>
    </div>
  );
}


export default function MyBookingsPage({ session }) {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBookings = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('parking_spots')
        .select('*')
        .eq('booked_by_user_id', session.user.id)
        .neq('is_available', true);
      
      if (data) {
        setBookings(data);
      }
      setLoading(false);
    };

    fetchBookings();
  }, [session.user.id]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <p className="text-lg animate-pulse">Loading Your Bookings...</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-800">My Bookings</h1>
        <p className="text-gray-500 mt-1">Here are your active parking sessions.</p>
      </div>

      {bookings.length === 0 ? (
        <div className="text-center p-12 bg-white rounded-lg border-2 border-dashed">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No active bookings</h3>
          <p className="mt-1 text-sm text-gray-500">Go to the map to book a new spot.</p>
          <div className="mt-6">
            <Link to="/" className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500">
              Find a Spot
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {bookings.map(spot => (
            <div key={spot.id} className="p-6 bg-white border rounded-lg shadow-md flex flex-col sm:flex-row items-center justify-between">
              <div className="mb-4 sm:mb-0">
                <h2 className="text-2xl font-semibold text-gray-900">{spot.name}</h2>
                <p className="text-gray-500 mt-1">Status: <span className="font-medium text-red-500">Booked</span></p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-500 mb-1">Time Remaining</p>
                <div className="text-purple-600">
                  <Countdown expiry={spot.booked_until} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}