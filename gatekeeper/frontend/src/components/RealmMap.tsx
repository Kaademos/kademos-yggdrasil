import React from 'react';
import { useProductionRealms } from '../hooks/useRealms';
import { Realm } from '../types/realm';

interface RealmNodeProps {
  realm: Realm;
  side: 'left' | 'right';
}

const RealmNode: React.FC<RealmNodeProps> = ({ realm, side }) => {
  const cardClasses = `group relative rounded-lg overflow-hidden border-2 transition-all duration-300 w-full
    ${realm.locked ? 'border-red-900/50 cursor-not-allowed' : 'hover:scale-105 cursor-pointer'}
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
              className="w-16 h-16 text-red-400 mx-auto mb-2"
              fill="currentColor"
              viewBox="0 0 20 20"
              style={{ filter: 'drop-shadow(0 0 10px rgba(248, 113, 113, 0.6))' }}
            >
              <path
                fillRule="evenodd"
                d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                clipRule="evenodd"
              />
            </svg>
            <p className="text-red-300 font-semibold text-sm">CLASSIFIED</p>
          </div>
        </div>
      )}

      {/* Content Overlay */}
      <div className="absolute inset-0 flex flex-col justify-between p-4 z-20">
        {/* Top: Emblem + Realm Order Badge */}
        <div className="flex justify-between items-start">
          <span
            className="text-3xl drop-shadow-lg"
            role="img"
            aria-label={`${realm.displayName} emblem`}
            style={{ filter: `drop-shadow(0 0 8px ${realm.theme.primaryColor}80)` }}
          >
            {realm.theme.icon}
          </span>
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
          <p className="text-sm text-gray-200 line-clamp-2 drop-shadow-md">{realm.description}</p>

          {/* Status Badge */}
          <div className="flex items-center gap-2">
            <div
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-sm
              ${realm.locked ? 'bg-red-900/60 text-red-200' : 'bg-green-900/60 text-green-200'}
            `}
            >
              <span
                className={`w-2 h-2 rounded-full ${realm.locked ? 'bg-red-400' : 'bg-green-400'}`}
                style={{
                  boxShadow: realm.locked
                    ? '0 0 8px rgba(248, 113, 113, 0.8)'
                    : '0 0 8px rgba(74, 222, 128, 0.8)',
                }}
              ></span>
              {realm.locked ? 'Classified' : 'Available'}
            </div>
          </div>

          {/* OWASP Category */}
          <p className="text-xs text-gray-300 font-medium drop-shadow-md">{realm.theme.category}</p>
        </div>
      </div>
    </div>
  );

  return (
    <li
      data-testid={`realm-node-${realm.name}`}
      className={`relative flex flex-col md:flex-row items-center gap-4 md:gap-0 ${
        side === 'left' ? 'md:flex-row' : 'md:flex-row-reverse'
      }`}
    >
      {/* Card */}
      <div className={`w-full md:w-[calc(50%-3rem)] ${side === 'left' ? 'md:pr-0' : 'md:pl-0'}`}>
        {realm.locked ? (
          <div className={cardClasses} style={cardStyle}>
            {cardContent}
          </div>
        ) : (
          <a href={`/realms/${realm.name}/`} className={cardClasses} style={cardStyle}>
            {cardContent}
          </a>
        )}
      </div>

      {/* Trunk node marker */}
      <div className="hidden md:flex w-24 justify-center shrink-0">
        <span
          className="w-5 h-5 rounded-full border-2 border-slate-900"
          style={{
            backgroundColor: realm.locked ? '#7f1d1d' : realm.theme.primaryColor,
            boxShadow: realm.locked
              ? '0 0 10px rgba(127, 29, 29, 0.8)'
              : `0 0 14px ${realm.theme.primaryColor}`,
          }}
        />
      </div>

      {/* Spacer to balance the opposite side */}
      <div className="hidden md:block w-[calc(50%-3rem)]" />
    </li>
  );
};

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

  // The Ascent: Asgard (order 1) renders at the top, Niflheim (order 10) at the roots
  const ascentRealms = [...realms].sort((a, b) => a.order - b.order);

  return (
    <section className="relative py-20 px-4 bg-slate-950 overflow-hidden">
      {/* World Tree backdrop — the platform architecture in disguise */}
      <div
        className="absolute inset-0 bg-cover bg-top opacity-20 pointer-events-none"
        style={{ backgroundImage: 'url(/assets/yggdrasil-map.webp)' }}
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-950/60 to-slate-950 pointer-events-none"
        aria-hidden="true"
      />

      <div className="relative max-w-5xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2
            className="text-4xl md:text-5xl font-bold tracking-widest mb-4 uppercase"
            style={{
              fontFamily: 'Cinzel, serif',
              textShadow: '0 0 20px rgba(59, 130, 246, 0.3)',
            }}
          >
            The Ten Realms
          </h2>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            Ascend the World Tree — from the frozen roots of Niflheim to the Golden Citadel of
            Asgard
          </p>
        </div>

        {/* The Ascent: vertical trunk with realm nodes */}
        <div className="relative">
          {/* Trunk — data sap flowing upward */}
          <div
            className="hidden md:block absolute left-1/2 top-0 bottom-0 w-1 -translate-x-1/2 rounded-full"
            style={{
              background:
                'linear-gradient(to top, #1d4ed8, #7c3aed, #b45309, #0ea5e9, #fb923c, #f59e0b, #34d399, #2dd4bf, #93c5fd, #facc15)',
              boxShadow: '0 0 18px rgba(59, 130, 246, 0.5)',
            }}
            aria-hidden="true"
          />

          <ul className="space-y-10 list-none" data-testid="realm-ascent">
            {ascentRealms.map((realm, i) => (
              <RealmNode key={realm.name} realm={realm} side={i % 2 === 0 ? 'left' : 'right'} />
            ))}
          </ul>
        </div>

        {/* Entry Point Hint */}
        <div className="mt-12 text-center">
          <p className="text-gray-400">
            <span className="text-blue-400 font-semibold">Niflheim</span> awaits. The frozen depths
            call to you.
          </p>
        </div>
      </div>
    </section>
  );
};
