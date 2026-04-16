import { motion } from 'framer-motion';
import Contact from '../components/Contact';

const ContactPage = () => {
  return (
    <div className="pt-24 min-h-screen">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="max-w-7xl mx-auto px-6 py-12"
      >
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-7xl font-black mb-6 text-slate-900">Contact Us</h1>
          <p className="text-xl text-slate-500 max-w-2xl mx-auto font-medium">
            Have a question or want to collaborate? Reach out to the Fync team.
          </p>
        </div>
        <Contact />
      </motion.div>
    </div>
  );
};

export default ContactPage;
