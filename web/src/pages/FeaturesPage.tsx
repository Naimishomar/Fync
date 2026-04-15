import React from 'react';
import { motion } from 'framer-motion';
import Features from '../components/Features';

const FeaturesPage = () => {
  return (
    <div className="pt-24 min-h-screen">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="max-w-7xl mx-auto px-6 py-12"
      >
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-7xl font-black mb-6 text-slate-900">Platform Features</h1>
          <p className="text-xl text-slate-500 max-w-2xl mx-auto font-medium">
            Discover the deep technical capabilities that make Fync the ultimate ecosystem for professionals.
          </p>
        </div>
        <Features />
      </motion.div>
    </div>
  );
};

export default FeaturesPage;
