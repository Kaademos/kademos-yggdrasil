import React, { useState, useEffect } from 'react';
import { Hero } from './components/Hero';
import { WeaversPath } from './components/WeaversPath';
import { RealmMap } from './components/RealmMap';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);

  // Check authentication status on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/realms', {
          credentials: 'same-origin',
        });
        // If we get realms data, we might be authenticated
        // The API works for both auth and unauth, so we check a user endpoint if available
        setIsAuthenticated(response.ok);
      } catch (error) {
        setIsAuthenticated(false);
      } finally {
        setChecking(false);
      }
    };

    checkAuth();
  }, []);

  const handleCTAClick = () => {
    // Navigate directly to Niflheim (trailing slash ensures correct asset paths)
    window.location.href = '/realms/niflheim/';
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-400 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading the Bifröst Gate...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <Hero onCTAClick={handleCTAClick} />
      <WeaversPath />
      <RealmMap />
      
      {/* Footer */}
      <footer className="bg-slate-950 border-t border-white/10 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-gray-500 text-sm">
          <p>Project Yggdrasil - A journey through the OWASP Top 10 2025</p>
          <p className="mt-2">Built for security training and education</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
