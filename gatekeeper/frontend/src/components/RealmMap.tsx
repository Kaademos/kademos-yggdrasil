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
                ? 'border-red-900/50 opacity-60 grayscale hover:grayscale-0 cursor-not-allowed' 
                : 'border-green-500/50 hover:border-green-400 hover:scale-105 cursor-pointer'
              }
              ${!realm.locked && 'animate-pulse hover:animate-none'}
            `;
            const cardStyle = {
              boxShadow: realm.locked 
                ? '0 0 10px rgba(127, 29, 29, 0.3)' 
                : '0 0 20px rgba(34, 197, 94, 0.4)',
            };

            const cardContent = (
              <>
              {/* Realm Image Placeholder */}
              <div 
                className="h-48 bg-gradient-to-br flex items-center justify-center"
                style={{
                  backgroundImage: `linear-gradient(135deg, ${realm.theme.primaryColor}20, ${realm.theme.primaryColor}40)`,
                }}
              >
                {/* Lock Icon for locked realms */}
                {realm.locked && (
                  <svg className="w-12 h-12 text-red-400 absolute" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                )}
                
                {/* Realm Order Badge */}
                <div className="absolute top-2 right-2 bg-black/70 px-3 py-1 rounded-full text-sm font-bold">
                  #{realm.order}
                </div>
              </div>

              {/* Realm Info */}
              <div className="p-4 bg-slate-950/90">
                <h3 className="font-bold text-lg mb-1" style={{ fontFamily: 'Cinzel, serif' }}>
                  {realm.displayName}
                </h3>
                <p className="text-xs text-gray-400 mb-2 line-clamp-2">
                  {realm.description}
                </p>
                
                {/* Status Badge */}
                <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold
                  ${realm.locked ? 'bg-red-900/50 text-red-300' : 'bg-green-900/50 text-green-300'}
                `}>
                  <span className={`w-2 h-2 rounded-full ${realm.locked ? 'bg-red-400' : 'bg-green-400'}`}></span>
                  {realm.locked ? 'Classified' : 'Available'}
                </div>

                {/* OWASP Category */}
                <p className="text-xs text-gray-500 mt-2 truncate">
                  {realm.theme.category}
                </p>
              </div>
              </>
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
