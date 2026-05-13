import { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Lenis from 'lenis';

import Navbar from './components/Navbar';
import Footer from './components/Footer';
import LandingPage from './pages/LandingPage';
import UploadPage from './pages/UploadPage';
import LoginPage from './pages/LoginPage';

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/login" replace />;
  return children;
};

function App() {
  const lenisRef = useRef(null);
  const location = useLocation();

  // Show navbar/footer only if NOT on login page
  const showLayout = location.pathname !== '/login';

  useEffect(() => {
    let lenis;
    try {
      lenis = new Lenis({
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        syncTouch: false,
      });

      lenisRef.current = lenis;

      let rafId;
      const raf = (time) => {
        lenis.raf(time);
        rafId = requestAnimationFrame(raf);
      };
      rafId = requestAnimationFrame(raf);

      return () => {
        cancelAnimationFrame(rafId);
        if (lenis) lenis.destroy();
      };
    } catch (error) {
      console.error("Lenis init error:", error);
    }
  }, []);

  return (
    <div className="bg-[#ffffff] dark:bg-[#0d150e] text-[#111827] dark:text-[#dce5d8] text-[16px] font-[400] leading-[1.6] min-h-screen flex flex-col relative overflow-x-hidden transition-colors duration-300">
      {showLayout && <Navbar />}
      
      <main className="flex-grow">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route 
            path="/upload" 
            element={
              <ProtectedRoute>
                <UploadPage />
              </ProtectedRoute>
            } 
          />
        </Routes>
      </main>

      {showLayout && <Footer />}
    </div>
  );
}

export default App;
