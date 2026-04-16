import { motion } from 'framer-motion';
import Download from '../components/Download';

const DownloadPage = () => {
  return (
    <div className="pt-24 min-h-screen">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="max-w-7xl mx-auto px-6 py-12"
      >
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-7xl font-black mb-6 text-slate-900">Get the App</h1>
          <p className="text-xl text-slate-500 max-w-2xl mx-auto font-medium">
            Start your journey with Fync today. Secure, fast, and built for performance.
          </p>
        </div>
        <Download />
      </motion.div>
    </div>
  );
};

export default DownloadPage;
