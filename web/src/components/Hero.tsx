import { motion } from 'framer-motion';
import { Download, ChevronRight, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import logo from '../assets/Fync.jpg';


const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center pt-32 pb-20 md:pb-12 overflow-hidden">
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-indigo-100 rounded-full blur-[120px]" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-slate-100 rounded-full blur-[120px]" />
      
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center relative z-10">
        <div className="text-center lg:text-left">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-8"
          >
            <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
            <span className="text-sm font-semibold text-slate-600">Fync Early Access</span>
          </motion.div>
          
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black mb-6 leading-tight text-slate-900">
            The Future of <br />
            <span className="text-gradient">Social Ecosystems</span>
          </h1>

          
          <p className="text-lg md:text-xl text-slate-500 mb-10 max-w-2xl mx-auto lg:mx-0 leading-relaxed font-medium">
            Fync is a premium, high-performance platform for professionals and creators. 
            Connect, trade, and compete in a beautiful, optimized environment.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 mb-12 lg:mb-20">
            <Link to="/download" className="w-full sm:w-auto bg-black hover:bg-zinc-800 text-white px-8 py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 shadow-xl active:scale-95 group text-lg">
              Download APK
              <Download className="w-5 h-5 group-hover:translate-y-1 transition-transform" />
            </Link>
            <Link to="/features" className="w-full sm:w-auto bg-white hover:bg-slate-50 text-black border border-slate-200 px-8 py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 active:scale-95 text-lg">
              Explore Features
              <ChevronRight className="w-5 h-5" />
            </Link>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8 }}
          className="relative flex items-center justify-center pt-8 lg:pt-0"
        >
          <div className="relative w-64 md:w-72 h-[520px] md:h-[580px] bg-white rounded-[3rem] border-8 border-slate-100 shadow-xl overflow-hidden">
            <div className="p-8 h-full flex flex-col items-center justify-center text-center gap-6">
              <div className="w-16 h-16 md:w-20 md:h-20 overflow-hidden rounded-full shadow-2xl">
                <img src={logo} alt="Fync" className="w-full h-full object-cover" />
              </div>

              <div>
                <h3 className="text-xl md:text-2xl font-bold text-slate-900">Fync Ecosystem</h3>

                <p className="text-xs md:text-sm text-slate-400 mt-2 font-medium italic">Empowering your creativity.</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>

  );
};

export default Hero;
