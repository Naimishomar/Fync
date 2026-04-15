import logo from '../assets/Fync.jpg';

const Footer = () => {
  return (
    <footer className="py-12 px-6 border-t border-slate-100">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
        <div className="flex items-center gap-2">
          <img src={logo} alt="Fync" className="w-6 h-6 rounded-full shadow-sm" />
          <span className="text-lg font-bold tracking-tight text-slate-900">Fync</span>
        </div>


        
        <p className="text-slate-400 text-sm font-medium">
          &copy; {new Date().getFullYear()} Fync Ecosystem. All rights reserved.
        </p>
      </div>
    </footer>

  );
};

export default Footer;
