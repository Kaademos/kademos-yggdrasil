import React from 'react';

interface PathStep {
  title: string;
  description: string;
  icon: React.ReactNode;
}

const steps: PathStep[] = [
  {
    title: 'The Hunt',
    description: 'Examine the realm. Map its defenses. Identify weaknesses in the Weave. Every vulnerability is a thread you can pull.',
    icon: (
      <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
    ),
  },
  {
    title: 'The Forge',
    description: 'Weaponize your knowledge. Craft exploits with precision. Strike at the heart of each realm\'s flaw. The Weave bends to those who understand it.',
    icon: (
      <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
      </svg>
    ),
  },
  {
    title: 'The Ascent',
    description: 'Recover the Realm Flag. Submit it to the Oracle to unlock the bridge to the next layer. With each conquest, you climb closer to Asgard.',
    icon: (
      <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
  },
];

export const WeaversPath: React.FC = () => {
  return (
    <section className="py-20 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2
            className="text-4xl md:text-5xl font-bold tracking-widest mb-4 uppercase"
            style={{
              fontFamily: 'Cinzel, serif',
              textShadow: '0 0 20px rgba(59, 130, 246, 0.3)',
            }}
          >
            The Weaver's Path
          </h2>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            Three steps guide every ascent through the corrupted realms
          </p>
        </div>

        {/* Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step, index) => (
            <div
              key={index}
              className="group relative bg-white/5 border border-white/10 rounded-lg p-8
                         transition-all duration-300 hover:scale-105 hover:bg-white/10
                         hover:shadow-2xl"
              style={{
                boxShadow: '0 0 0 rgba(59, 130, 246, 0.2)',
                transition: 'all 0.3s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 10px 40px rgba(59, 130, 246, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 0 0 rgba(59, 130, 246, 0.2)';
              }}
            >
              {/* Step Number */}
              <div className="absolute -top-4 -left-4 w-12 h-12 bg-blue-600 rounded-full
                              flex items-center justify-center font-bold text-xl
                              shadow-lg shadow-blue-500/50">
                {index + 1}
              </div>

              {/* Icon */}
              <div className="text-blue-400 mb-6 transition-colors duration-300 group-hover:text-blue-300">
                {step.icon}
              </div>

              {/* Title */}
              <h3 className="text-2xl font-bold mb-4 tracking-wide" style={{ fontFamily: 'Cinzel, serif' }}>
                {step.title}
              </h3>

              {/* Description */}
              <p className="text-gray-400 leading-relaxed">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
