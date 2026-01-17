/**
 * Navbar Component
 * Shared ribbon that appears on every page with Settings and Logs icons
 */

import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { usePreferences } from '../../contexts/PreferencesContext';
import OmadaLogo from '../../Omadalogo.png';
import './Navbar.css';

// European language translations for "Welcome" with country flags
const WELCOME_TRANSLATIONS = [
  { text: 'Welcome', flag: '🇬🇧' },
  { text: 'Bienvenue', flag: '🇫🇷' },
  { text: 'Willkommen', flag: '🇩🇪' },
  { text: 'Bienvenido', flag: '🇪🇸' },
  { text: 'Benvenuto', flag: '🇮🇹' },
  { text: 'Bem-vindo', flag: '🇵🇹' },
  { text: 'Welkom', flag: '🇳🇱' },
  { text: 'Velkommen', flag: '🇩🇰' },
  { text: 'Välkommen', flag: '🇸🇪' },
  { text: 'Velkommen', flag: '🇳🇴' },
  { text: 'Tervetuloa', flag: '🇫🇮' },
  { text: 'Witamy', flag: '🇵🇱' },
  { text: 'Vítejte', flag: '🇨🇿' },
  { text: 'Vitajte', flag: '🇸🇰' },
  { text: 'Üdvözöljük', flag: '🇭🇺' },
  { text: 'Bun venit', flag: '🇷🇴' },
  { text: 'Dobrodošli', flag: '🇭🇷' },
  { text: 'Καλώς ήρθατε', flag: '🇬🇷' },
];

const Navbar = ({ title }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { getPreference } = usePreferences();
  const [welcomeIndex, setWelcomeIndex] = useState(0);

  const isHomePage = location.pathname === '/';
  const isWelcomeTitle = title === 'Welcome';
  const welcomeAnimationSpeed = getPreference('welcomeAnimationSpeed', 5000);

  // Cycle through welcome translations
  useEffect(() => {
    if (!isWelcomeTitle || welcomeAnimationSpeed <= 0) return;

    const interval = setInterval(() => {
      setWelcomeIndex((prev) => (prev + 1) % WELCOME_TRANSLATIONS.length);
    }, welcomeAnimationSpeed);

    return () => clearInterval(interval);
  }, [isWelcomeTitle, welcomeAnimationSpeed]);

  return (
    <div className="navbar">
      <div className="navbar-content">
        {/* Left Section - Logo, Back button, and Title */}
        <div className="navbar-left">
          <img src={OmadaLogo} alt="Omada" className="navbar-logo" onClick={() => navigate('/')} />
          {!isHomePage && (
            <button onClick={() => navigate('/')} className="navbar-back-btn" title="Back to Dashboard">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
            </button>
          )}
          <h1 className="navbar-title">
            {isWelcomeTitle ? (
              welcomeAnimationSpeed > 0 ? (
                <span
                  className="welcome-cycling"
                  key={welcomeIndex}
                  style={{ animationDuration: `${welcomeAnimationSpeed}ms` }}
                >
                  {WELCOME_TRANSLATIONS[welcomeIndex].text} {WELCOME_TRANSLATIONS[welcomeIndex].flag}
                </span>
              ) : (
                <span>{WELCOME_TRANSLATIONS[0].text} {WELCOME_TRANSLATIONS[0].flag}</span>
              )
            ) : (
              title || 'Omada Identity Management'
            )}
          </h1>
        </div>

        {/* Right Section - Icons and User */}
        <div className="navbar-right">
          {/* My Access (Key) Icon */}
          <button
            onClick={() => navigate('/my-access')}
            className={`navbar-icon-btn ${location.pathname === '/my-access' ? 'active' : ''}`}
            title="My Access"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path>
            </svg>
          </button>

          {/* Access Lens (Magnifying Glass/Lens) Icon */}
          <button
            onClick={() => navigate('/access-lens')}
            className={`navbar-icon-btn ${location.pathname === '/access-lens' ? 'active' : ''}`}
            title="Access Lens"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              <circle cx="11" cy="11" r="3"></circle>
            </svg>
          </button>

          {/* Administration (Hammer) Icon */}
          <button
            onClick={() => navigate('/admin')}
            className={`navbar-icon-btn ${location.pathname === '/admin' ? 'active' : ''}`}
            title="Administration"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
            </svg>
          </button>

          {/* My Team Icon */}
          <button
            onClick={() => navigate('/my-team')}
            className={`navbar-icon-btn ${location.pathname === '/my-team' ? 'active' : ''}`}
            title="My Team"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
          </button>

          {/* Settings Icon */}
          <button
            onClick={() => navigate('/settings')}
            className={`navbar-icon-btn ${location.pathname === '/settings' ? 'active' : ''}`}
            title="Settings"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </button>

          {/* API Logs Icon */}
          <button
            onClick={() => navigate('/logs')}
            className={`navbar-icon-btn ${location.pathname === '/logs' ? 'active' : ''}`}
            title="API Logs"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
          </button>

          {/* Divider */}
          <div className="navbar-divider"></div>

          {/* User Email */}
          {user && user.email && (
            <span className="navbar-user-email">{user.email}</span>
          )}

          {/* Logout Icon */}
          <button onClick={logout} className="navbar-icon-btn logout" title="Sign Out">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Navbar;
