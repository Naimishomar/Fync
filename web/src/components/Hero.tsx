import { motion } from 'framer-motion';
import { Download, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import appScreenshot from '../assets/Screenshot_1776261682.png';

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
          {/* Main Phone Mockup */}
          <div className="relative w-64 md:w-[280px] aspect-[9/19] bg-slate-900 rounded-[3rem] p-[6px] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.3)] border-2 border-slate-800/50">
            {/* Side Buttons */}
            <div className="absolute top-24 -right-1 w-1 h-12 bg-slate-800 rounded-r-md" />
            <div className="absolute top-20 -left-1 w-1 h-8 bg-slate-800 rounded-l-md" />
            
            {/* Shine */}
            <div className="absolute inset-0 rounded-[2.9rem] bg-gradient-to-tr from-white/10 to-transparent pointer-events-none z-10" />
            
            <div className="w-full h-full rounded-[2.7rem] overflow-hidden bg-black flex items-center justify-center relative">
              {/* Status Bar */}
              <div className="absolute top-0 left-0 right-0 h-10 px-6 flex items-center justify-between z-30 text-[10px] text-white/40 font-bold pointer-events-none">
                <span>9:41</span>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-sm border border-white/20" />
                  <div className="w-3 h-3 rounded-full bg-white/20" />
                </div>
              </div>

              <img 
                src={appScreenshot} 
                alt="Fync App Feed" 
                className="w-full h-full object-cover" 
              />
            </div>
          </div>

          {/* Decorative Floating Element */}
          <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-indigo-600/10 rounded-full blur-3xl -z-10" />
        </motion.div>
      </div>
    </section>

  );
};

export default Hero;
