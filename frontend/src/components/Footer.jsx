// Footer.jsx – Shared footer component

const Footer = () => {
  return (
    <footer className="bg-[#0d150e] w-full py-8 md:py-12 mt-12 md:mt-20 border-t border-[#3c4a3d]/20 relative z-10">
      <div className="flex flex-col md:flex-row justify-between items-center px-4 md:px-margin max-w-7xl mx-auto gap-8 md:gap-4 text-center md:text-left">

        {/* Copyright */}
        <div className="text-[11px] md:text-xs font-bold text-[#dce5d8] uppercase tracking-widest opacity-60 order-2 md:order-1">
          © {new Date().getFullYear()} WhatsApp Automator. <span className="hidden sm:inline">Built for performance.</span>
        </div>

        {/* Footer Links */}
        <nav className="flex flex-wrap justify-center gap-6 md:gap-8 order-1 md:order-2">
          <a
            href="#"
            className="text-[#bbcbb9] hover:text-[#25d366] transition-colors text-[11px] md:text-xs font-bold uppercase tracking-widest"
          >
            Terms
          </a>
          <a
            href="#"
            className="text-[#bbcbb9] hover:text-[#25d366] transition-colors text-[11px] md:text-xs font-bold uppercase tracking-widest"
          >
            Privacy
          </a>
          <a
            href="#"
            className="text-[#bbcbb9] hover:text-[#25d366] transition-colors text-[11px] md:text-xs font-bold uppercase tracking-widest"
          >
            Support
          </a>
        </nav>

      </div>
    </footer>
  );
};

export default Footer;
