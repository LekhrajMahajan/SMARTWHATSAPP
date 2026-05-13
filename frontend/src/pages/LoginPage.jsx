import { useState } from 'react';
import axios from 'axios';
import { BASE_URL } from '../api';
import { useNavigate } from 'react-router-dom';

const LoginPage = () => {
  // ... (keeping state and logic unchanged)
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }
    
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        const formData = new FormData();
        formData.append('username', email); 
        formData.append('password', password);

        const response = await axios.post(`${BASE_URL}/token`, formData);
        localStorage.setItem('token', response.data.access_token);
        navigate('/');
      } else {
        const formData = new FormData();
        formData.append('username', username);
        formData.append('email', email);
        formData.append('password', password);

        await axios.post(`${BASE_URL}/register`, formData);
        setIsLogin(true);
        setError('Registration successful! Please login.');
      }
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (typeof detail === 'object') {
        setError(JSON.stringify(detail));
      } else {
        setError(detail || 'An error occurred');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0d150e] p-4 md:p-6 transition-colors duration-300 relative overflow-hidden">
      {/* Background Glows */}
      <div className="absolute top-[-10%] right-[-10%] w-[60vw] md:w-[40vw] h-[60vw] md:h-[40vw] rounded-full bg-[#25d366]/5 blur-[80px] md:blur-[120px] pointer-events-none animate-pulse"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-[60vw] md:w-[40vw] h-[60vw] md:h-[40vw] rounded-full bg-[#59dcb5]/5 blur-[80px] md:blur-[120px] pointer-events-none animate-pulse" style={{ animationDelay: '2s' }}></div>

      <div className="bg-[#121b22]/80 backdrop-blur-2xl w-full max-w-[480px] p-6 md:p-10 rounded-2xl md:rounded-3xl border border-[#3c4a3d]/30 shadow-2xl relative z-10 transition-all">
        
        <div className="text-center mb-10 md:mb-12">
          <div className="w-16 h-16 md:w-20 md:h-20 bg-[#25d366]/10 rounded-2xl flex items-center justify-center border border-[#25d366]/20 mx-auto mb-6 md:mb-8 rotate-3 hover:rotate-0 transition-transform duration-300">
            <span className="material-symbols-outlined text-[#25d366] text-[32px] md:text-[40px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              {isLogin ? 'key' : 'person_add'}
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl lg:text-[40px] font-[900] text-[#dce5d8] tracking-tight mb-3">
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h1>
          <p className="text-[#bbcbb9] text-base md:text-lg font-normal opacity-80 max-w-[280px] md:max-w-none mx-auto leading-relaxed">
            {isLogin ? 'Access your automated campaigns' : 'Join the elite network of senders'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
          {!isLogin && (
            <div className="space-y-2">
              <label className="text-xs md:text-sm font-semibold text-[#bbcbb9] ml-1 uppercase tracking-wider opacity-60">Username</label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#bbcbb9]/40 group-focus-within:text-[#25d366] transition-colors text-[20px]">person</span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="w-full pl-12 pr-4 py-3 md:py-3.5 bg-[#0d150e]/50 border border-[#3c4a3d] rounded-xl outline-none focus:border-[#25d366] focus:ring-1 focus:ring-[#25d366]/30 transition-all text-[#dce5d8] text-sm md:text-base placeholder-[#bbcbb9]/10"
                  placeholder="Choose a username"
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs md:text-sm font-semibold text-[#bbcbb9] ml-1 uppercase tracking-wider opacity-60">Email Address</label>
            <div className="relative group">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#bbcbb9]/40 group-focus-within:text-[#25d366] transition-colors text-[20px]">alternate_email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full pl-12 pr-4 py-3 md:py-3.5 bg-[#0d150e]/50 border border-[#3c4a3d] rounded-xl outline-none focus:border-[#25d366] focus:ring-1 focus:ring-[#25d366]/30 transition-all text-[#dce5d8] text-sm md:text-base placeholder-[#bbcbb9]/10"
                placeholder="name@example.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs md:text-sm font-semibold text-[#bbcbb9] ml-1 uppercase tracking-wider opacity-60">Password</label>
            <div className="relative group">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#bbcbb9]/40 group-focus-within:text-[#25d366] transition-colors text-[20px]">lock_person</span>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full pl-12 pr-12 py-3 md:py-3.5 bg-[#0d150e]/50 border border-[#3c4a3d] rounded-xl outline-none focus:border-[#25d366] focus:ring-1 focus:ring-[#25d366]/30 transition-all text-[#dce5d8] text-sm md:text-base placeholder-[#bbcbb9]/10"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#bbcbb9]/40 hover:text-[#25d366] transition-colors focus:outline-none flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-[20px]">
                  {showPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 md:p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
              <span className="material-symbols-outlined text-red-400 text-[20px] mt-0.5">warning</span>
              <p className="text-red-400 text-xs md:text-sm font-medium leading-relaxed">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 md:py-4 bg-[#25d366] text-[#003915] rounded-xl font-bold text-base md:text-lg hover:bg-[#4ff07f] transition-all duration-300 shadow-[0_0_20px_rgba(37,211,102,0.3)] hover:shadow-[0_0_35px_rgba(37,211,102,0.5)] active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3 group mt-2"
          >
            {loading ? (
              <span className="w-5 h-5 md:w-6 md:h-6 border-2 border-[#003915]/30 border-t-[#003915] rounded-full animate-spin"></span>
            ) : (
              <>
                {isLogin ? 'Login to Dashboard' : 'Create My Account'}
                <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform text-[20px]">arrow_forward</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-6 md:mt-8 text-center pt-6 md:pt-8 border-t border-[#3c4a3d]/20">
          <p className="text-[#bbcbb9] text-xs md:text-sm">
            {isLogin ? "Don't have an account?" : "Already a member?"}{' '}
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-[#25d366] font-bold hover:text-[#4ff07f] transition-colors ml-1"
            >
              {isLogin ? 'Sign up for free' : 'Sign in here'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
