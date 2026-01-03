import React from 'react';

interface HeroProps {
  onCTAClick: () => void;
}

export const Hero: React.FC<HeroProps> = ({ onCTAClick }) => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-800" />
      
      {/* Subtle grid pattern */}
      <div className="absolute inset-0 opacity-10" style={{
        backgroundImage: `linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
                         linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)`,
        backgroundSize: '50px 50px'
      }} />

      {/* Content */}
      <div className="relative z-10 text-center px-4 max-w-6xl mx-auto">
        {/* Yggdrasil Image */}
        <div className="mb-12 flex justify-center">
          <div className="relative">
            {/* Glow effect behind image */}
            <div 
              className="absolute inset-0 blur-3xl opacity-40"
              style={{
                background: 'radial-gradient(ellipse at center, rgba(59, 130, 246, 0.4) 0%, rgba(234, 179, 8, 0.2) 40%, transparent 70%)',
                transform: 'scale(1.5)',
              }}
            />
            {/* Yggdrasil Image with blending */}
            <img
              src="/assets/ygg.webp"
              alt="Yggdrasil - The World Tree"
              className="relative z-10 w-auto max-w-md md:max-w-lg lg:max-w-xl h-auto"
              style={{
                filter: 'drop-shadow(0 0 40px rgba(59, 130, 246, 0.4)) drop-shadow(0 0 80px rgba(234, 179, 8, 0.2))',
                maskImage: 'radial-gradient(ellipse 90% 90% at center, black 50%, transparent 100%)',
                WebkitMaskImage: 'radial-gradient(ellipse 90% 90% at center, black 50%, transparent 100%)',
              }}
            />
          </div>
        </div>

        {/* Headline */}
        <h1
          className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-widest mb-6 uppercase"
          style={{
            fontFamily: 'Cinzel, serif',
            textShadow: '0 0 30px rgba(59, 130, 246, 0.5)',
          }}
        >
          THE TREE IS ROTTING.
        </h1>

        {/* Subheadline */}
        <p className="text-xl md:text-2xl lg:text-3xl text-gray-300 mb-12 tracking-wide">
          Ten Realms. Ten Vulnerabilities. One Weaver.
        </p>

        {/* CTA Button */}
        <button
          onClick={onCTAClick}
          className="glassmorphism px-8 py-4 rounded-lg text-lg font-semibold tracking-wider uppercase
                     transition-all duration-300 hover:scale-105 hover:bg-white/20
                     focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-slate-950
                     animate-pulse hover:animate-none"
          aria-label="Begin Yggdrasil Challenge"
          style={{
            boxShadow: '0 0 20px rgba(59, 130, 246, 0.3)',
          }}
        >
          <span className="text-shadow-glow">INITIATE ASCENSION</span>
        </button>

        {/* Subtle hint */}
        <p className="mt-8 text-sm text-gray-500 tracking-wide">
          Begin your journey through the Nine Realms
        </p>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-slate-800 to-transparent" />
    </section>
  );
};
