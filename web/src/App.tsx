import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import FeaturesPage from './pages/FeaturesPage';
import DownloadPage from './pages/DownloadPage';
import ContactPage from './pages/ContactPage';
import CodingArena from './pages/CodingArena';
import ContestDashboard from './pages/ContestDashboard';
import Matchmaking from './pages/Matchmaking';
import BugFinder from './pages/BugFinder';
import Login from './pages/Login';
import ArenaAdminDashboard from './pages/ArenaAdminDashboard';
import CreateProblem from './pages/CreateProblem';
import CreateBugMission from './pages/CreateBugMission';
import CreateContest from './pages/CreateContest';
import ContestDetails from './pages/ContestDetails';
import Profile from './pages/Profile';

const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-indigo-500/10 selection:text-indigo-900">
        <ScrollToTop />
        <Navbar />
        
        <main>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/features" element={<FeaturesPage />} />
            <Route path="/download" element={<DownloadPage />} />
            <Route path="/contact" element={<ContactPage />} />
            
            {/* Coding Platform Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/arena" element={<ContestDashboard />} />
            <Route path="/arena/contest/:contestId" element={<ContestDetails />} />
            <Route path="/arena/problem/:problemId" element={<CodingArena />} />
            <Route path="/arena/matchmaking" element={<Matchmaking />} />
            <Route path="/arena/bugs" element={<BugFinder />} />
            <Route path="/arena/bug/:problemId" element={<CodingArena />} />
            <Route path="/profile" element={<Profile />} />

            {/* Arena Admin Routes */}
            <Route path="/arena/admin" element={<ArenaAdminDashboard />} />
            <Route path="/arena/admin/create-problem" element={<CreateProblem />} />
            <Route path="/arena/admin/create-bug" element={<CreateBugMission />} />
            <Route path="/arena/admin/create-contest" element={<CreateContest />} />
          </Routes>
        </main>

        <Footer />
      </div>
    </Router>
  );
}

export default App;
