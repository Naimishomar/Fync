import { motion } from 'framer-motion';

const MOCKUPS = [
  {
    id: 1,
    title: "Activity Feed",
    image: "/mockup-feed.png"
  },
  {
    id: 2,
    title: "Coding Arena",
    image: "/mockup-arena.png"
  }
];

const Screenshots = () => {
  return (
    <section id="demo" className="py-24 px-6 overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-5xl font-bold mb-4"
          >
            Experience the <span className="text-gradient">Interface</span>
          </motion.h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            A seamless, intuitive experience designed for high-performance interaction and community engagement.
          </p>
        </div>

        <div className="relative">
          {/* Decorative elements */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full md:w-[800px] h-[300px] md:h-[400px] bg-indigo-50 rounded-full blur-[100px] md:blur-[120px] -z-10" />
          
          <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-12">
            {MOCKUPS.map((mockup, index) => (
              <motion.div
                key={mockup.id}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.2 }}
                className="relative group w-full max-w-[280px]"
              >
                <div className="relative w-full aspect-[9/19] bg-white rounded-[3rem] p-4 border border-slate-100 shadow-xl overflow-hidden group-hover:shadow-2xl transition-all duration-500">
                  <div className="w-full h-full rounded-[2.5rem] overflow-hidden">
                    <img 
                      src={mockup.image} 
                      alt={mockup.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    />
                  </div>
                </div>
                <div className="mt-8 text-center">
                  <h4 className="text-xl font-bold text-slate-900">{mockup.title}</h4>
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
