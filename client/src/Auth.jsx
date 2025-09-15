import { useState } from 'react';
import { supabase } from './supabaseClient';
import toast from 'react-hot-toast'; // 👈 Import toast for notifications

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error(error.error_description || error.message); // 👈 Use toast for errors
    }
    setLoading(false);
  };

  const handleSignUp = async (event) => {
    event.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      toast.error(error.error_description || error.message); // 👈 Use toast for errors
    } else {
      toast.success('Sign up successful! Please check your email for a confirmation link.'); // 👈 Use toast for success
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
      <div className="p-8 bg-white rounded-xl shadow-lg w-full max-w-md">
        <h1 className="text-3xl font-bold mb-2 text-center text-purple-600">Park My Car</h1>
        <p className="mb-8 text-center text-gray-500">Sign in or create an account to get started</p>
        <form onSubmit={handleLogin}>
          <div className="mb-4">
            <label htmlFor="email" className="block text-gray-700 font-medium mb-2">Email Address</label>
            <input
              id="email"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
              type="email"
              placeholder="you@example.com"
              value={email}
              required
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="mb-6">
            <label htmlFor="password" className="block text-gray-700 font-medium mb-2">Password</label>
            <input
              id="password"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
              type="password"
              placeholder="Your password"
              value={password}
              required
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <button
              type="submit"
              className="w-full sm:w-auto flex-1 py-3 px-4 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 disabled:opacity-75 transition-colors"
              disabled={loading}
            >
              {loading ? <span>Loading...</span> : <span>Login</span>}
            </button>
            <button
              type="button"
              onClick={handleSignUp}
              className="w-full sm:w-auto flex-1 py-3 px-4 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 disabled:opacity-75 transition-colors"
              disabled={loading}
            >
              {loading ? <span>Loading...</span> : <span>Sign Up</span>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}