import React from 'react';
import { useProductionRealms } from '../hooks/useRealms';

export const RealmMap: React.FC = () => {
  const { realms, loading, error } = useProductionRealms();

  if (loading) {
    return (
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-700 rounded w-64 mx-auto mb-4"></div>
            <div className="h-4 bg-gray-700 rounded w-96 mx-auto"></div>
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto text-center text-red-400">
          <p>Failed to load realms. Please try again later.</p>
        </div>
      </section>
    );
  }

  // Sort realms by order (10 to 1)
  const sortedRealms = [...realms].sort((a, b) => b.order - a.order);

  return (
    <section className="py-20 px-4 bg-gradient-to-b from-slate-800 to-slate-900">
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
            The Nine Realms
          </h2>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            Your journey begins in Niflheim and ascends to the Golden Citadel of Asgard
          </p>
        </div>

        {/* Realm Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
          {sortedRealms.map((realm) => {
            const cardClasses = `group relative rounded-lg overflow-hidden border-2 transition-all duration-300
              ${realm.locked 
                ? 'border-red-900/50 cursor-not-allowed' 
                : 'hover:scale-105 cursor-pointer'
              }
            `;
            const cardStyle = {
              boxShadow: realm.locked 
                ? '0 0 15px rgba(127, 29, 29, 0.4)' 
                : `0 0 20px ${realm.theme.primaryColor}40`,
              borderColor: realm.locked ? 'rgba(127, 29, 29, 0.5)' : realm.theme.primaryColor,
            };

            const cardContent = (
              <div className="relative h-80 overflow-hidden">
                {/* Background Image with Ken Burns Effect */}
                <div 
                  className="absolute inset-0 bg-cover bg-center transition-transform duration-700 ease-out group-hover:scale-110"
                  style={{
                    backgroundImage: `url(${realm.theme.image})`,
                    filter: realm.locked ? 'grayscale(100%) brightness(0.4)' : 'none',
                  }}
                />
                
                {/* Scrim Gradient for Text Readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
                
                {/* Lock Overlay for Locked Realms */}
                {realm.locked && (
                  <div className="absolute inset-0 flex items-center justify-center z-10">
                    <div className="text-center">
                      <svg 
                        className="w-20 h-20 text-red-400 mx-auto mb-2" 
                        fill="currentColor" 
                        viewBox="0 0 20 20"
                        style={{ filter: 'drop-shadow(0 0 10px rgba(248, 113, 113, 0.6))' }}
                      >
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                      </svg>
                      <p className="text-red-300 font-semibold text-sm">CLASSIFIED</p>
                    </div>
                  </div>
                )}
                
                {/* Content Overlay */}
                <div className="absolute inset-0 flex flex-col justify-between p-4 z-20">
                  {/* Top: Realm Order Badge */}
                  <div className="flex justify-end">
                    <div 
                      className="bg-black/80 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-bold border"
                      style={{ 
                        borderColor: realm.locked ? 'rgba(239, 68, 68, 0.5)' : `${realm.theme.primaryColor}60`,
                        color: realm.locked ? '#fca5a5' : realm.theme.primaryColor,
                      }}
                    >
                      #{realm.order}
                    </div>
                  </div>
                  
                  {/* Bottom: Realm Info */}
                  <div className="space-y-2">
                    <h3 
                      className="font-bold text-2xl text-white drop-shadow-lg" 
                      style={{ fontFamily: 'Cinzel, serif' }}
                    >
                      {realm.displayName}
                    </h3>
                    <p className="text-sm text-gray-200 line-clamp-2 drop-shadow-md">
                      {realm.description}
                    </p>
                    
                    {/* Status Badge */}
                    <div className="flex items-center gap-2">
                      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-sm
                        ${realm.locked ? 'bg-red-900/60 text-red-200' : 'bg-green-900/60 text-green-200'}
                      `}>
                        <span 
                          className={`w-2 h-2 rounded-full ${realm.locked ? 'bg-red-400' : 'bg-green-400'}`}
                          style={{ 
                            boxShadow: realm.locked 
                              ? '0 0 8px rgba(248, 113, 113, 0.8)' 
                              : '0 0 8px rgba(74, 222, 128, 0.8)' 
                          }}
                        ></span>
                        {realm.locked ? 'Classified' : 'Available'}
                      </div>
                    </div>

                    {/* OWASP Category */}
                    <p className="text-xs text-gray-300 font-medium drop-shadow-md">
                      {realm.theme.category}
                    </p>
                  </div>
                </div>
              </div>
            );

            // Render clickable link for unlocked realms, div for locked
            return realm.locked ? (
              <div key={realm.name} className={cardClasses} style={cardStyle}>
                {cardContent}
              </div>
            ) : (
              <a
                key={realm.name}
                href={`/realms/${realm.name}/`}
                className={cardClasses}
                style={cardStyle}
              >
                {cardContent}
              </a>
            );
          })}
        </div>

        {/* Entry Point Hint */}
        <div className="mt-12 text-center">
          <p className="text-gray-400">
            <span className="text-blue-400 font-semibold">Niflheim</span> awaits. The frozen depths call to you.
          </p>
        </div>
      </div>
    </section>
  );
};
