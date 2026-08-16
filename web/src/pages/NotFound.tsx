import { Link } from 'react-router-dom';
import { AlertTriangle, Home } from 'lucide-react';

const NotFound = () => {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-8">
      <div className="bg-white border border-slate-200 w-24 h-24 rounded-[32px] flex items-center justify-center mb-8 shadow-xl">
        <AlertTriangle size={44} className="text-indigo-600" />
      </div>
      <h1 className="text-6xl font-black tracking-tighter uppercase mb-4 text-slate-900">404</h1>
      <p className="text-slate-400 text-[11px] font-black uppercase tracking-[0.3em] mb-12">
        Signal Lost — Route Not Found
      </p>
      <Link
        to="/"
        className="bg-slate-900 text-white px-10 py-5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:bg-black transition-all flex items-center gap-3"
      >
        <Home size={18} /> Return to Base
      </Link>
    </div>
  );
};

export default NotFound;