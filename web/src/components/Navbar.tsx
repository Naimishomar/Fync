import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import logo from '../assets/Fync.jpg';

const Navbar = () => {

  const [isOpen, setIsOpen] = useState(false);

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


        
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-500">
          <Link to="/" className="hover:text-black transition-colors">Home</Link>
          <Link to="/features" className="hover:text-black transition-colors">Features</Link>
          <Link to="/download" className="hover:text-black transition-colors">Download</Link>
          <Link to="/contact" className="hover:text-black transition-colors">Contact</Link>
        </div>

        <div className="flex items-center gap-4">
          <Link 
            to="/download" 
            className="hidden sm:block bg-black hover:bg-zinc-800 text-white px-5 py-2 rounded-xl text-sm font-semibold transition-all shadow-lg active:scale-95"
          >
            Download
          </Link>
          
          <button 
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden p-2 text-slate-600 hover:text-black transition-colors"
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
            className="absolute top-20 left-4 right-4 glass rounded-[2rem] p-6 shadow-2xl md:hidden flex flex-col gap-6 items-center"
          >
            <Link to="/" onClick={() => setIsOpen(false)} className="text-lg font-semibold text-slate-600">Home</Link>
            <Link to="/features" onClick={() => setIsOpen(false)} className="text-lg font-semibold text-slate-600">Features</Link>
            <Link to="/download" onClick={() => setIsOpen(false)} className="text-lg font-semibold text-slate-600">Download</Link>
            <Link to="/contact" onClick={() => setIsOpen(false)} className="text-lg font-semibold text-slate-600">Contact</Link>
            <Link 
              to="/download" 
              onClick={() => setIsOpen(false)}
              className="w-full bg-black text-white py-4 rounded-2xl font-bold text-center shadow-lg"
            >
              Download App
            </Link>
          </motion.div>
        )}
      </AnimatePresence>

    </motion.nav>
  );
};


export default Navbar;
