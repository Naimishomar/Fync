import { motion } from 'framer-motion';
import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// Import screenshots
import ss1 from '../assets/Screenshot_1776261682.png';
import ss2 from '../assets/Screenshot_1776261697.png';
import ss3 from '../assets/Screenshot_1776261715.png';
import ss4 from '../assets/Screenshot_1776261730.png';
import ss5 from '../assets/Screenshot_1776261738.png';
import ss6 from '../assets/Screenshot_1776261745.png';
import ss7 from '../assets/Screenshot_1776261752.png';
import ss8 from '../assets/Screenshot_1776261760.png';
import ss9 from '../assets/Screenshot_1776261776.png';

const MOCKUPS = [
  {
    id: 1,
    title: "Dynamic Feed",
    image: ss1
  },
  {
    id: 2,
    title: "Internships",
    image: ss2
  },
  {
    id: 3,
    title: "Placement Hub",
    image: ss3
  },
  {
    id: 4,
    title: "College Confession Feed",
    image: ss4
  },
  {
    id: 5,
    title: "Night Club",
    image: ss5
  },
  {
    id: 6,
    title: "Messaging",
    image: ss6
  },
  {
    id: 7,
    title: "Digital Profile",
    image: ss7
  },
  {
    id: 8,
    title: "Funding Feed",
    image: ss8
  },
  {
    id: 9,
    title: "Technical Reels",
    image: ss9
  }
];

const Screenshots = () => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const { scrollLeft, clientWidth } = scrollContainerRef.current;
      const scrollTo = direction === 'left' 
        ? scrollLeft - clientWidth
        : scrollLeft + clientWidth;
      
      scrollContainerRef.current.scrollTo({
        left: scrollTo,
        behavior: 'smooth'
      });
    }
  };

  return (
    <section id="demo" className="py-24 px-6 overflow-hidden bg-slate-50/30">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8 mb-16">
          <div className="text-center md:text-left">
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-3xl md:text-5xl font-bold mb-4 text-slate-900"
            >
              Experience the <span className="text-gradient">Interface</span>
            </motion.h2>
            <p className="text-slate-500 max-w-2xl mx-auto md:mx-0 text-lg">
              A seamless, intuitive experience designed for high-performance interaction.
            </p>
          </div>

          <div className="flex gap-4">
            <button 
              onClick={() => scroll('left')}
              className="p-4 rounded-full bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition-all shadow-sm active:scale-95"
              aria-label="Previous screenshots"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button 
              onClick={() => scroll('right')}
              className="p-4 rounded-full bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition-all active:scale-95"
              aria-label="Next screenshots"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="relative">
          {/* Decorative background blur */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full md:w-[1000px] h-[500px] bg-indigo-100/40 rounded-full blur-[120px] -z-10" />
          
          {/* Horizontal Scroll Container */}
          <div 
            ref={scrollContainerRef}
            className="flex overflow-x-auto pb-12 pt-4 px-4 gap-8 md:gap-12 scrollbar-hide snap-x snap-mandatory"
          >
            {MOCKUPS.map((mockup, index) => (
              <motion.div
                key={mockup.id}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
                className="flex-shrink-0 flex flex-col items-center group snap-center"
              >
                <div className="relative w-[280px] aspect-[9/19] bg-slate-900 rounded-[3rem] p-[10px] transition-all duration-500 group-hover:-translate-y-2">
                  {/* Power Button */}
                  <div className="absolute top-24 -right-[2px] w-[3px] h-12 bg-slate-800 rounded-r-sm" />
                  {/* Volume Buttons */}
                  <div className="absolute top-20 -left-[2px] w-[3px] h-8 bg-slate-800 rounded-l-sm" />
                  <div className="absolute top-32 -left-[2px] w-[3px] h-8 bg-slate-800 rounded-l-sm" />

                  {/* Phone Frame Shine */}
                  <div className="absolute inset-0 rounded-[3rem] bg-gradient-to-tr from-white/10 to-transparent pointer-events-none z-10" />
                  
                  <div className="w-full h-full rounded-[2.2rem] overflow-hidden bg-black flex items-center justify-center relative">
                    {/* Status Bar */}
                    <div className="absolute top-0 left-0 right-0 h-10 px-6 flex items-center justify-between z-30 text-[10px] text-white/40 font-bold pointer-events-none">
                      <span>9:41</span>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-sm border border-white/20" />
                        <div className="w-3 h-3 rounded-full bg-white/20" />
                      </div>
                    </div>

                    {/* Inner Screen Glow */}
                    <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none z-20" />

                    <img 
                      src={mockup.image} 
                      alt={mockup.title}
                      className="w-full h-full object-cover transition-transform duration-1000"
                    />
                  </div>

                  {/* Top Notch Area (Decorative) */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-8 bg-slate-900 rounded-b-3xl z-40 flex items-center justify-center p-1">
                    <div className="w-10 h-1 bg-slate-800 rounded-full" />
                    <div className="w-1.5 h-1.5 bg-slate-800 rounded-full ml-2" />
                  </div>
                </div>
                
                <div className="mt-8 text-center">
                  <h4 className="text-xl font-bold text-slate-800 mb-2 group-hover:text-indigo-600 transition-colors">{mockup.title}</h4>
                  <div className="h-1 w-8 bg-indigo-500 mx-auto rounded-full scale-x-0 group-hover:scale-x-100 transition-transform duration-300" />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Screenshots;
