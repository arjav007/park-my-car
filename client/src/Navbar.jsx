// client/src/Navbar.jsx
import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';

export default function Navbar({ userEmail, onSignOut }) {
  const [isOpen, setIsOpen] = useState(false);

  const linkClasses = "text-gray-600 hover:bg-purple-100 hover:text-purple-600 px-3 py-2 rounded-md text-sm font-medium transition-colors";
  const activeLinkClasses = "bg-purple-600 text-white";

  return (
    <nav className="bg-white shadow-sm fixed top-0 left-0 right-0 z-[1000]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex-shrink-0 font-bold text-2xl text-purple-600">
              Park My Car
            </Link>
          </div>
          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-4">
              <NavLink to="/" className={({ isActive }) => `${linkClasses} ${isActive ? activeLinkClasses : ''}`}>Map View</NavLink>
              <NavLink to="/my-bookings" className={({ isActive }) => `${linkClasses} ${isActive ? activeLinkClasses : ''}`}>My Bookings</NavLink>
            </div>
          </div>
          <div className="hidden md:flex items-center">
            <span className="text-gray-600 text-sm mr-4">Hi, {userEmail}</span>
            <button onClick={onSignOut} className="text-sm font-semibold text-red-500 hover:text-red-700 transition-colors">
              Sign Out
            </button>
          </div>
          <div className="-mr-2 flex md:hidden">
            <button onClick={() => setIsOpen(!isOpen)} type="button" className="bg-gray-100 inline-flex items-center justify-center p-2 rounded-md text-gray-700 hover:bg-gray-200 focus:outline-none">
              <svg className="h-6 w-6" stroke="currentColor" fill="none" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={!isOpen ? 'M4 6h16M4 12h16M4 18h16' : 'M6 18L18 6M6 6l12 12'} />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {isOpen && (
        <div className="md:hidden" id="mobile-menu">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            <NavLink to="/" className={({ isActive }) => `block ${linkClasses} ${isActive ? activeLinkClasses : ''}`}>Map View</NavLink>
            <NavLink to="/my-bookings" className={({ isActive }) => `block ${linkClasses} ${isActive ? activeLinkClasses : ''}`}>My Bookings</NavLink>
          </div>
          <div className="pt-4 pb-3 border-t border-gray-200">
            <div className="flex items-center px-5">
              <div className="text-base font-medium leading-none text-gray-800">{userEmail}</div>
            </div>
            <div className="mt-3 px-2 space-y-1">
              <button onClick={() => { onSignOut(); setIsOpen(false); }} className="block w-full text-left rounded-md px-3 py-2 text-base font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-800">
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}