import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import logo from '../assets/Fync.jpg';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const { user, token, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  // Hide navbar on coding arena pages for better visibility
  const hidePaths = ['/arena/problem/', '/arena/bug/', '/arena/matchmaking', '/arena/match/'];
  if (hidePaths.some(path => location.pathname.startsWith(path))) {
    return null;
  }

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className="fixed top-0 left-0 right-0 z-50 px-4 md:px-6 py-4"
    >
      <div className="max-w-7xl mx-auto glass rounded-[1.5rem] px-4 md:px-6 py-3 flex items-center justify-between relative z-50">
        <Link to="/" className="flex items-center gap-2">
          <img src={logo} alt="Fync" className="w-8 h-8 rounded-full shadow-sm" />
          <span className="text-xl font-bold tracking-tight text-slate-900">Fync</span>
        </Link>



        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
          <Link to="/" className="hover:text-slate-900 transition-colors">Home</Link>
          <Link to="/features" className="hover:text-slate-900 transition-colors">Features</Link>
          <Link to="/arena" className="hover:text-pink-600 text-slate-900 font-black transition-colors">Arena</Link>
          <Link to="/download" className="hover:text-slate-900 transition-colors">Download</Link>
          <Link to="/contact" className="hover:text-slate-900 transition-colors">Contact</Link>
        </div>

        <div className="flex items-center gap-4">
          {token && user ? (
            <div className="flex items-center gap-5">
              <Link
                to="/profile"
                className="flex items-center gap-3 px-4 py-2 bg-white shadow-sm rounded-2xl border border-slate-200 hover:border-indigo-600 hover:shadow-md transition-all group overflow-hidden relative"
              >
                <div className="absolute inset-0 bg-indigo-50/50 opacity-0 group-hover:opacity-100 transition-opacity" />
                <img
                  src={user.avatar || 'https://cdn-icons-png.freepik.com/512/219/219988.png'}
                  alt={user.name}
                  className="w-8 h-8 rounded-full object-cover border border-slate-100 shadow-sm relative z-10"
                />
                <div className="flex flex-col relative z-10">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-indigo-600 transition-colors">Commander</span>
                  <span className="text-[11px] font-black uppercase tracking-tighter text-slate-900 leading-none">{user.name}</span>
                </div>
              </Link>
              <button
                onClick={() => {
                  logout();
                  window.location.href = '/';
                }}
                className="hidden sm:block bg-slate-900 hover:bg-black text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg active:scale-95"
              >
                Logout
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="hidden sm:block bg-black hover:bg-zinc-800 text-white px-5 py-2 rounded-xl text-sm font-semibold transition-all shadow-lg active:scale-95"
            >
              Login
            </Link>
          )}

          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden p-2 text-slate-700 hover:text-black transition-colors"
          >
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-20 left-4 right-4 glass rounded-[2rem] p-8 shadow-2xl md:hidden flex flex-col gap-6 items-center"
          >
            {token && user && (
              <Link
                to="/profile"
                onClick={() => setIsOpen(false)}
                className="flex flex-col items-center gap-3 p-6 bg-white rounded-3xl w-full border border-slate-100 shadow-sm hover:border-indigo-600 transition-all active:scale-95 group"
              >
                <img
                  src={user.avatar || 'https://cdn-icons-png.freepik.com/512/219/219988.png'}
                  alt={user.name}
                  className="w-16 h-16 rounded-full object-cover border-4 border-slate-50 shadow-md group-hover:scale-105 transition-transform"
                />
                <div className="text-center">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tactical Commander</p>
                  <p className="text-lg font-black  tracking-tighter uppercase text-slate-900 leading-tight">{user.name}</p>
                </div>
              </Link>
            )}
            <Link to="/" onClick={() => setIsOpen(false)} className="text-lg font-bold text-slate-600 hover:text-slate-900">Home</Link>
            <Link to="/features" onClick={() => setIsOpen(false)} className="text-lg font-bold text-slate-600 hover:text-slate-900">Features</Link>
            <Link to="/arena" onClick={() => setIsOpen(false)} className="text-lg font-black text-pink-600">Arena</Link>
            <Link to="/download" onClick={() => setIsOpen(false)} className="text-lg font-bold text-slate-600 hover:text-slate-900">Download</Link>
            <Link to="/contact" onClick={() => setIsOpen(false)} className="text-lg font-bold text-slate-600 hover:text-slate-900">Contact</Link>
            {token ? (
              <button
                onClick={() => {
                  setIsOpen(false);
                  logout();
                  window.location.href = '/';
                }}
                className="w-full bg-zinc-900 text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl"
              >
                Logout Account
              </button>
            ) : (
              <Link
                to="/login"
                onClick={() => setIsOpen(false)}
                className="w-full bg-black text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl text-center"
              >
                Login to Platform
              </Link>
            )}
          </motion.div>
        )}
      </AnimatePresence>

    </motion.nav>
  );
};


export default Navbar;
