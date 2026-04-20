import { useLocation } from 'react-router-dom';
import logo from '../assets/Fync.jpg';

const Footer = () => {
  const location = useLocation();
  const hidePaths = ['/arena/problem/', '/arena/bug/', '/arena/matchmaking'];
  if (hidePaths.some(path => location.pathname.startsWith(path))) {
    return null;
  }

  return (
    <footer className="py-12 px-6 border-t border-slate-100 bg-white">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
        <div className="flex items-center gap-3">
          <img src={logo} alt="Fync" className="w-8 h-8 rounded-full shadow-sm" />
          <span className="text-xl font-black tracking-tighter italic uppercase text-slate-900">Fync</span>
        </div>

        <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest opacity-60">
          &copy; {new Date().getFullYear()} Fync Technical Ecosystem. All rights reserved.
        </p>
      </div>
    </footer>
  );
};

export default Footer;
