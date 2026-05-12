import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const [isDark] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);



  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
    setIsMenuOpen(false);
  };

  return (
    <nav className="fixed top-0 w-full z-50 bg-[#ffffff]/70 dark:bg-[#0d150e]/70 backdrop-blur-md border-b border-[#e5e7eb] dark:border-[#3c4a3d]/30 shadow-sm transition-colors duration-300">
      <div className="flex justify-between items-center w-full px-4 md:px-8 py-3 max-w-7xl mx-auto">

        {/* Logo */}
        <Link
          to="/"
          onClick={() => setIsMenuOpen(false)}
          className="text-lg md:text-[24px] font-[800] text-[#25d366] cursor-pointer flex items-center gap-1.5 md:gap-2"
        >
          <span className="material-symbols-outlined text-[24px] md:text-[32px]">send_and_archive</span>
          <span className="tracking-tight truncate max-w-[180px] xs:max-w-none">SmartWA</span>
        </Link>

        {/* Desktop Nav Links */}
        <div className="hidden lg:flex items-center gap-8">
          <Link
            to="/"
            className={`text-[12px] font-[500] tracking-[0.05em] uppercase transition-colors duration-200 ${location.pathname === '/'
                ? 'text-[#25d366] border-b-2 border-[#25d366] pb-1'
                : 'text-[#4b5563] dark:text-[#bbcbb9] hover:text-[#25d366]'
              }`}
          >
            Home
          </Link>

          <a
            href="/#features"
            className="text-[#4b5563] dark:text-[#bbcbb9] text-[12px] font-[500] tracking-[0.05em] uppercase hover:text-[#25d366] transition-colors duration-200"
          >
            Features
          </a>

          <a
            href="/#how-it-works"
            className="text-[#4b5563] dark:text-[#bbcbb9] text-[12px] font-[500] tracking-[0.05em] uppercase hover:text-[#25d366] transition-colors duration-200"
          >
            How It Works
          </a>
        </div>

        <div className="flex items-center gap-2 md:gap-4">


          <div className="hidden md:flex items-center gap-4">
            {token ? (
              <>
                <Link
                  to="/upload"
                  className={`px-4 lg:px-6 py-2 rounded-lg text-[11px] lg:text-[12px] font-[700] uppercase transition-all duration-200 shadow-[0_0_15px_rgba(37,211,102,0.3)] ${location.pathname === '/upload'
                      ? 'bg-[#25d366] text-[#003915]'
                      : 'bg-[#25d366]/20 text-[#25d366] hover:bg-[#25d366] hover:text-[#003915]'
                    }`}
                >
                  Upload Files
                </Link>
                <button
                  onClick={handleLogout}
                  className="text-[#ffb4ab] text-[11px] lg:text-[12px] font-[700] uppercase hover:bg-[#ffb4ab]/10 px-3 lg:px-4 py-2 rounded-lg transition-all"
                >
                  Logout
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="px-6 py-2 rounded-full bg-[#25d366] text-[#003915] text-[13px] font-[700] hover:shadow-[0_0_20px_rgba(37,211,102,0.4)] transition-all active:scale-[0.98]"
              >
                Get Started
              </Link>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden p-2 text-[#4b5563] dark:text-[#bbcbb9] hover:text-[#25d366] transition-colors"
          >
            <span className="material-symbols-outlined text-[28px]">
              {isMenuOpen ? 'close' : 'menu'}
            </span>
          </button>
        </div>

      </div>

      {/* Mobile Menu Backdrop */}
      {isMenuOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[-1] md:hidden"
          onClick={() => setIsMenuOpen(false)}
        />
      )}

      {/* Mobile Menu Content */}
      <div className={`absolute top-full left-0 w-full bg-[#ffffff] dark:bg-[#0d150e] border-b border-[#e5e7eb] dark:border-[#3c4a3d]/50 md:hidden transition-all duration-300 overflow-hidden ${isMenuOpen ? 'max-h-[400px] py-6' : 'max-h-0 py-0'}`}>
        <div className="flex flex-col px-8 gap-6">
          <Link
            to="/"
            onClick={() => setIsMenuOpen(false)}
            className={`text-[14px] font-[600] uppercase tracking-wider ${location.pathname === '/' ? 'text-[#25d366]' : 'text-[#4b5563] dark:text-[#bbcbb9]'}`}
          >
            Home
          </Link>
          <a
            href="/#features"
            onClick={() => setIsMenuOpen(false)}
            className="text-[#4b5563] dark:text-[#bbcbb9] text-[14px] font-[600] uppercase tracking-wider"
          >
            Features
          </a>
          <a
            href="/#how-it-works"
            onClick={() => setIsMenuOpen(false)}
            className="text-[#4b5563] dark:text-[#bbcbb9] text-[14px] font-[600] uppercase tracking-wider"
          >
            How It Works
          </a>

          <div className="pt-4 border-t border-[#e5e7eb] dark:border-[#3c4a3d]/30 flex flex-col gap-4">
            {token ? (
              <>
                <Link
                  to="/upload"
                  onClick={() => setIsMenuOpen(false)}
                  className="w-full py-3 bg-[#25d366] text-[#003915] text-center rounded-lg font-[700] uppercase"
                >
                  Upload Files
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full py-3 text-[#ffb4ab] border border-[#ffb4ab]/30 rounded-lg font-[700] uppercase"
                >
                  Logout
                </button>
              </>
            ) : (
              <Link
                to="/login"
                onClick={() => setIsMenuOpen(false)}
                className="w-full py-3 bg-[#25d366] text-[#003915] text-center rounded-lg font-[700] uppercase"
              >
                Get Started
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};


export default Navbar;
