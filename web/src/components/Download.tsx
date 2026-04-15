import { motion } from 'framer-motion';
import { Download as DownloadIcon } from 'lucide-react';


const Download = () => {
  return (
    <section id="download" className="py-2 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="glass rounded-[2.5rem] md:rounded-[3rem] p-8 md:p-20 text-center relative overflow-hidden border-slate-100 shadow-xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full blur-[80px] -mr-32 -mt-32" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-slate-50 rounded-full blur-[80px] -ml-32 -mb-32" />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative z-10"
          >
            <div className="w-16 h-16 md:w-20 md:h-20 bg-black rounded-2xl md:rounded-3xl flex items-center justify-center mx-auto mb-6 md:mb-8 shadow-2xl">
              <DownloadIcon className="w-8 h-8 md:w-10 md:h-10 text-white" />
            </div>
            
            <h2 className="text-3xl md:text-5xl font-bold mb-4 md:mb-6 text-slate-900">Experience Fync Beta</h2>
            <p className="text-sm md:text-lg text-slate-500 mb-8 md:mb-10 max-w-xl mx-auto leading-relaxed font-medium px-4">
              Join our exclusive early access program. Download the standalone APK for Android and start building today.
            </p>
            
            <div className="flex flex-col items-center justify-center gap-6 mb-10 md:mb-12">
              <div className="flex flex-col items-center gap-2 w-full max-w-[350px]">
                <button className="w-full bg-black text-white px-8 py-4 md:py-5 rounded-2xl font-bold text-base md:text-lg flex items-center justify-center gap-3 hover:bg-zinc-800 transition-all active:scale-95 shadow-xl">
                  Coming soon (Play store)
                  <span className="text-[10px] md:text-xs px-2 py-0.5 bg-white/20 text-white rounded-full">BETA</span>
                </button>
                <span className="text-xs text-slate-400 font-bold tracking-wide uppercase">Coming soon to Play Store</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default Download;
