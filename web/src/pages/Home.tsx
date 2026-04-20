import Hero from '../components/Hero';
import Features from '../components/Features';
import Screenshots from '../components/Screenshots';
import Download from '../components/Download';
import Contact from '../components/Contact';
import CodingArenaTeaser from '../components/CodingArenaTeaser';

const Home = () => {
  return (
    <>
      <Hero />
      <CodingArenaTeaser />
      <Features />
      <Screenshots />
      <Download />
      <Contact />
    </>
  );
};

export default Home;
