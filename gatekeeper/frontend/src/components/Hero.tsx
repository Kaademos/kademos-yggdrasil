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
        {/* Yggdrasil Illustration Placeholder */}
        <div className="mb-12 flex justify-center">
          <div className="relative">
            {/* SVG Tree Illustration - Simplified */}
            <svg
              width="300"
              height="300"
              viewBox="0 0 300 300"
              className="opacity-90"
              style={{
                filter: 'drop-shadow(0 0 30px rgba(59, 130, 246, 0.3))'
              }}
            >
              {/* Roots (frozen blue) */}
              <g stroke="#60a5fa" strokeWidth="3" fill="none" opacity="0.8">
                <path d="M 150 250 Q 120 270 90 290" />
                <path d="M 150 250 Q 150 275 150 300" />
                <path d="M 150 250 Q 180 270 210 290" />
              </g>
              
              {/* Trunk (fiery orange gradient) */}
              <defs>
                <linearGradient id="trunkGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#f97316" />
                  <stop offset="100%" stopColor="#ea580c" />
                </linearGradient>
              </defs>
              <rect x="140" y="100" width="20" height="150" fill="url(#trunkGradient)" rx="2" />
              
              {/* Canopy (golden) */}
              <g fill="#eab308" opacity="0.9">
                <circle cx="150" cy="100" r="50" />
                <circle cx="120" cy="80" r="35" />
                <circle cx="180" cy="80" r="35" />
                <circle cx="130" cy="60" r="25" />
                <circle cx="170" cy="60" r="25" />
              </g>
              
              {/* Glow effect */}
              <circle cx="150" cy="150" r="120" fill="url(#glowGradient)" opacity="0.1" />
              <defs>
                <radialGradient id="glowGradient">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="transparent" />
                </radialGradient>
              </defs>
            </svg>
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
