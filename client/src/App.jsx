// client/src/App.jsx
import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { Toaster } from 'react-hot-toast'; // Import the Toaster
import Auth from './Auth';
import Navbar from './Navbar';
import HomePage from './HomePage';
import MyBookingsPage from './MyBookingsPage';


// Triggering a new Vercel deployment


function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return <div>Loading...</div>; // Or a spinner component
  }

  return (
    <BrowserRouter>
      {/* Add the Toaster component here for notifications */}
      <Toaster position="top-center" reverseOrder={false} />
      
      {!session ? (
        <Auth />
      ) : (
        <div className="relative h-screen">
          <Navbar 
            userEmail={session.user.email} 
            onSignOut={() => supabase.auth.signOut()} 
          />
          <main className="pt-16 h-full"> {/* Add padding-top to avoid content going under the navbar */}
            <Routes>
              <Route path="/" element={<HomePage session={session} />} />
              <Route path="/my-bookings" element={<MyBookingsPage session={session} />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </main>
        </div>
      )}
    </BrowserRouter>
  );
}

export default App;