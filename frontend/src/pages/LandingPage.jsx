import { useNavigate } from 'react-router-dom';

const LandingPage = () => {
  const navigate = useNavigate();
  return (
    <main className="grow pt-[80px] overflow-x-hidden">

      {/* Global ambient background glows */}
      <div className="fixed top-[-20%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-[#25d366]/5 blur-[120px] pointer-events-none z-[-1]"></div>
      <div className="fixed bottom-[-20%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-[#59dcb5]/5 blur-[100px] pointer-events-none z-[-1]"></div>

      {/* Hero Section */}
      <section className="relative min-h-[70vh] md:min-h-[90vh] flex items-center justify-center px-6 md:px-8 overflow-hidden bg-[#0a100b]" id="home">
        
        {/* THE GRID - Based on Image 2, but in Green */}
        <div className="absolute inset-0 grid-background opacity-100 z-0"></div>
        
        {/* Overlay to fade grid at edges */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#0a100b_90%)] z-1 pointer-events-none"></div>

        <div className="max-w-4xl mx-auto text-center z-10 flex flex-col items-center gap-6 md:gap-8 py-12 md:py-20 relative">
          <div className="inline-flex items-center gap-2 bg-[#25d366]/10 border border-[#25d366]/20 px-4 py-2 rounded-full mb-2">
            <span className="w-2 h-2 rounded-full bg-[#25d366] animate-pulse"></span>
            <span className="text-[#25d366] text-xs font-bold uppercase tracking-widest">Built for Safety & Growth</span>
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-[64px] font-extrabold leading-[1.1] tracking-tight text-[#dce5d8] drop-shadow-[0_0_15px_rgba(37,211,102,0.3)]">
            Automated WhatsApp Marketing — <span className="text-[#25d366]">Risk-Free</span>
          </h1>
          <p className="text-base md:text-lg lg:text-xl font-normal leading-relaxed text-[#bbcbb9] max-w-2xl mx-auto px-4">
            The smartest way to reach your customers. SmartWA follows human-like patterns with automated batches, safety windows, and personalized messaging to keep your account safe.
          </p>
          <div className="mt-8 md:mt-12 w-full flex justify-center">
            <button
              onClick={() => navigate('/upload')}
              className="w-full sm:w-auto bg-[#25d366] text-[#003915] px-8 sm:px-16 md:px-20 py-4 rounded-full text-lg sm:text-xl md:text-2xl font-semibold hover:bg-[#4ff07f] transition-all duration-300 shadow-[0_0_30px_rgba(37,211,102,0.4)] hover:shadow-[0_0_50px_rgba(37,211,102,0.6)] hover:-translate-y-1 flex items-center justify-center gap-4"
            >
              Start Your Campaign <span className="material-symbols-outlined">rocket_launch</span>
            </button>
          </div>
        </div>
      </section>

      {/* 2. STATS / SOCIAL PROOF BAR */}
      <section className="border-y border-[#3c4a3d]/20 bg-[#151e16]/30 backdrop-blur-sm py-12 px-6 md:px-8">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-gutter">
          {[
            { number: '800', label: 'Daily Message Limit' },
            { number: '100', label: 'Per Batch' },
            { number: '1hr', label: 'Smart Cooldown' },
            { number: '0', label: 'API Cost Forever' },
          ].map(({ number, label }) => (
            <div key={label} className="flex flex-col items-center text-center gap-1">
              <span className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-[#25d366] leading-none">{number}</span>
              <span className="text-[10px] md:text-xs font-medium tracking-wider text-[#bbcbb9] uppercase">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 3. FEATURES (BENTO GRID) */}
      <section className="py-16 md:py-24 px-6 md:px-8 max-w-7xl mx-auto relative z-10" id="features">
        <h2 className="text-3xl md:text-[32px] font-bold leading-tight text-center mb-12 md:mb-20 text-[#dce5d8]">Intelligent Sending Engine</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Feature 1 */}
          <div className="bg-[#121b22]/70 backdrop-blur-xl border border-[#869584]/20 p-6 md:p-8 rounded-xl flex flex-col gap-4 md:gap-6 hover:border-[#25d366]/50 transition-colors duration-300 group">
            <div className="w-12 h-12 rounded-full bg-[#19221a] flex items-center justify-center text-[#25d366] group-hover:scale-110 transition-transform duration-300 shadow-inner">
              <span className="material-symbols-outlined text-[24px]">folder_open</span>
            </div>
            <h3 className="text-xl md:text-2xl font-semibold leading-snug text-[#dce5d8]">Smart Batching</h3>
            <p className="text-sm md:text-base font-normal leading-relaxed text-[#bbcbb9]">
              We automatically split your list into batches of 100 contacts with a mandatory 1-hour cooldown to ensure natural delivery patterns.
            </p>
          </div>
          {/* Feature 2 */}
          <div className="bg-[#121b22]/70 backdrop-blur-xl border border-[#869584]/20 p-6 md:p-8 rounded-xl flex flex-col gap-4 md:gap-6 hover:border-[#25d366]/50 transition-colors duration-300 group">
            <div className="w-12 h-12 rounded-full bg-[#19221a] flex items-center justify-center text-[#25d366] group-hover:scale-110 transition-transform duration-300 shadow-inner">
              <span className="material-symbols-outlined text-[24px]">schedule</span>
            </div>
            <h3 className="text-xl md:text-2xl font-semibold leading-snug text-[#dce5d8]">Safety Window</h3>
            <p className="text-sm md:text-base font-normal leading-relaxed text-[#bbcbb9]">
              Messages are only sent during the optimal 10:00 AM – 06:00 PM (IST) window, maximizing engagement while minimizing spam risks.
            </p>
          </div>
          {/* Feature 3 */}
          <div className="bg-[#121b22]/70 backdrop-blur-xl border border-[#869584]/20 p-6 md:p-8 rounded-xl flex flex-col gap-4 md:gap-6 hover:border-[#25d366]/50 transition-colors duration-300 group sm:col-span-2 lg:col-span-1">
            <div className="w-12 h-12 rounded-full bg-[#19221a] flex items-center justify-center text-[#25d366] group-hover:scale-110 transition-transform duration-300 shadow-inner">
              <span className="material-symbols-outlined text-[24px]">qr_code_scanner</span>
            </div>
            <h3 className="text-xl md:text-2xl font-semibold leading-snug text-[#dce5d8]">QR Auth</h3>
            <p className="text-sm md:text-base font-normal leading-relaxed text-[#bbcbb9]">
              Direct browser automation via WhatsApp Web. Scan once, and our engine handles the rest securely from your machine.
            </p>
          </div>
        </div>
      </section>

      {/* 4. HOW IT WORKS */}
      <section className="py-16 md:py-24 px-6 md:px-8 bg-[#151e16]/30 border-y border-[#3c4a3d]/10" id="how-it-works">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-[32px] font-bold leading-tight text-center mb-12 md:mb-20 text-[#dce5d8]">How It Works</h2>
          <div className="flex flex-col md:flex-row gap-12 md:gap-8 justify-between items-start relative">
            {/* Connecting Line */}
            <div className="hidden md:block absolute top-[24px] left-[10%] right-[10%] h-px bg-linear-to-r from-transparent via-[#25d366]/30 to-transparent z-0"></div>
            {/* Step 1 */}
            <div className="flex-1 flex flex-col items-center text-center gap-6 md:gap-8 relative z-10 w-full">
              <div className="w-12 h-12 rounded-full bg-[#0d150e] border border-[#25d366] text-[#25d366] flex items-center justify-center text-xl md:text-2xl font-semibold shadow-[0_0_15px_rgba(37,211,102,0.2)]">
                1
              </div>
              <h4 className="text-xl md:text-2xl font-semibold leading-snug text-[#dce5d8]">Upload File</h4>
              <p className="text-xs text-[#bbcbb9]">Import contacts via XLSX or CSV with personalization tags.</p>
            </div>
            {/* Step 2 */}
            <div className="flex-1 flex flex-col items-center text-center gap-6 md:gap-8 relative z-10 w-full">
              <div className="w-12 h-12 rounded-full bg-[#0d150e] border border-[#25d366] text-[#25d366] flex items-center justify-center text-xl md:text-2xl font-semibold shadow-[0_0_15px_rgba(37,211,102,0.2)]">
                2
              </div>
              <h4 className="text-xl md:text-2xl font-semibold leading-snug text-[#dce5d8]">Scan QR Code</h4>
              <p className="text-xs text-[#bbcbb9]">Scan the WhatsApp Web QR code to securely link your account.</p>
            </div>
            {/* Step 3 */}
            <div className="flex-1 flex flex-col items-center text-center gap-6 md:gap-8 relative z-10 w-full">
              <div className="w-12 h-12 rounded-full bg-[#25d366] text-[#003915] flex items-center justify-center text-xl md:text-2xl font-semibold shadow-[0_0_20px_rgba(37,211,102,0.4)]">
                3
              </div>
              <h4 className="text-xl md:text-2xl font-semibold leading-snug text-[#dce5d8]">Automated Flow</h4>
              <p className="text-xs text-[#bbcbb9]">We handle the batches, cooldowns, and timing while you track logs.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. USE CASES SECTION */}
      <section className="py-16 md:py-24 px-6 md:px-8 max-w-7xl mx-auto">
        <div className="text-center mb-12 md:mb-16">
          <span className="text-xs md:text-sm font-medium text-[#25d366] uppercase tracking-widest">Built for Reliability</span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-[#dce5d8] mt-2">Maximum Efficiency, Zero Risk</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { icon: 'bolt', title: 'Personalized Reach', desc: 'Auto-inject names and custom data using {name} tags for 5x higher response rates.' },
            { icon: 'verified', title: 'Account Safety', desc: 'Mandatory 100-batch limit and 1-hour cooldown intervals prevent account flags.' },
            { icon: 'payments', title: 'Cost Savings', desc: 'No per-message API fees. Use your standard WhatsApp account for bulk outreach.' },
            { icon: 'history', title: 'Live Progress', desc: 'Real-time campaign logs with success/failure tracking and CSV export features.' },
            { icon: 'timer', title: 'Daily Discipline', desc: 'Strict 800-message daily cap ensures your outreach stays within natural limits.' },
            { icon: 'desktop_windows', title: 'Local Execution', desc: 'Your data stays on your machine. We only automate the browser actions.' },
          ].map(({ icon, title, desc }) => (
            <div
              key={title}
              className="bg-[#121b22]/70 backdrop-blur-xl border border-[#869584]/30 border-t-white/10 border-l-white/10 p-6 md:p-8 rounded-xl flex flex-col gap-2 hover:border-[#25d366]/50 transition-all duration-300 group cursor-default"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-[#242c24] flex items-center justify-center text-[#25d366] group-hover:bg-[#25d366]/20 transition-colors">
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1", fontSize: '20px' }}>{icon}</span>
                </div>
                <h3 className="text-xl md:text-2xl font-semibold leading-snug text-[#dce5d8]">{title}</h3>
              </div>
              <p className="text-sm md:text-base font-normal leading-relaxed text-[#bbcbb9]">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 7. COMPARISON TABLE */}
      <section className="py-16 md:py-24 px-6 md:px-8 max-w-5xl mx-auto">
        <div className="text-center mb-12 md:mb-16">
          <span className="text-xs md:text-sm font-medium text-[#25d366] uppercase tracking-widest">Why SmartWA?</span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-[#dce5d8] mt-2">Intelligent Outreach</h2>
        </div>

        <div className="bg-[#121b22]/50 border border-[#3c4a3d]/20 rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="border-b border-[#3c4a3d]/30 bg-[#151e16]/50">
                <th className="py-4 px-6 text-[#bbcbb9] text-xs md:text-xs font-medium uppercase tracking-wider">Safety Feature</th>
                <th className="py-4 px-6 text-[#25d366] text-xs md:text-xs font-bold uppercase tracking-wider text-center">Smart WhatsApp Sender</th>
                <th className="py-4 px-6 text-[#bbcbb9] text-xs md:text-xs font-medium uppercase tracking-wider text-center">Manual Copy-Paste</th>
                <th className="py-4 px-6 text-[#bbcbb9] text-xs md:text-xs font-medium uppercase tracking-wider text-center">Generic Bulk Tools</th>
              </tr>
            </thead>
            <tbody className="text-sm md:text-sm">
              {[
                ['Batch Cooldowns (1hr)', '✅ Built-in', '❌ Hard to track', '❌ Risky speed'],
                ['IST Time Window', '✅ Automated', '❌ Manual effort', '❌ Always active'],
                ['Daily Safety Cap (800)', '✅ Hard Limit', '❌ No tracking', '❌ No limit'],
                ['Name Personalization', '✅ Automated', '❌ Slow manual', '✅ Variable'],
                ['Local Data Control', '✅ 100% Local', '✅ Local', '❌ Cloud based'],
              ].map(([feature, us, manual, api]) => (
                <tr key={feature} className="border-b border-[#3c4a3d]/10 hover:bg-[#151e16]/30 transition-colors">
                  <td className="py-4 px-6 text-[#dce5d8]">{feature}</td>
                  <td className="py-4 px-6 text-center text-[#25d366] font-bold">{us}</td>
                  <td className="py-4 px-6 text-center text-[#bbcbb9]">{manual}</td>
                  <td className="py-4 px-6 text-center text-[#bbcbb9]">{api}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 8. FINAL CTA SECTION */}
      <section className="py-16 md:py-24 px-6 md:px-8 relative overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
          <div className="w-[600px] h-[300px] bg-[#25d366]/5 rounded-full blur-[100px]" />
        </div>

        <div className="max-w-3xl mx-auto text-center relative z-10">
          <div className="bg-[#121b22]/70 backdrop-blur-xl border border-[#25d366]/20 rounded-2xl p-10 md:p-20 flex flex-col items-center gap-6">
            <span className="material-symbols-outlined text-[#25d366]" style={{ fontVariationSettings: "'FILL' 1", fontSize: '48px' }}>
              verified_user
            </span>
            <h2 className="text-2xl md:text-4xl font-bold leading-tight text-[#dce5d8]">
              Send Smart. Stay Safe. Grow Fast.
            </h2>
            <p className="text-base md:text-lg font-normal leading-relaxed text-[#bbcbb9] max-w-lg">
              Experience the power of automated WhatsApp marketing that follows safety best practices by design. 
            </p>
            <button
              onClick={() => navigate('/upload')}
              className="mt-6 w-full sm:w-auto bg-[#25d366] text-[#003915] px-12 md:px-20 py-4 rounded-full text-xl md:text-[24px] font-[600] hover:bg-[#4ff07f] transition-all duration-300 shadow-[0_0_30px_rgba(37,211,102,0.4)] hover:shadow-[0_0_60px_rgba(37,211,102,0.6)] hover:-translate-y-1 flex items-center justify-center gap-2"
            >
              Start Safe Campaign
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 0" }}>
                arrow_forward
              </span>
            </button>
            <p className="text-[10px] md:text-[12px] font-[500] tracking-[0.05em] uppercase text-[#bbcbb9]/60">
              Auto-Batches &bull; 10 AM - 6 PM IST &bull; 800 Max / Day
            </p>
          </div>
        </div>
      </section>

    </main>
  );
};

export default LandingPage;
