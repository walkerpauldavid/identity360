/**
 * OAuth Callback Component
 * Handles the OAuth2 redirect callback
 */

import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import './Callback.css';

const Callback = () => {
  const navigate = useNavigate();
  const { handleCallback } = useAuth();
  const [error, setError] = useState(null);
  const [processing, setProcessing] = useState(true);
  const hasProcessed = useRef(false);

  useEffect(() => {
    const processCallback = async () => {
      // Prevent duplicate processing using a global flag in localStorage
      // This works across multiple component instances (React Strict Mode)
      const processingKey = 'oauth_callback_processing';

      if (hasProcessed.current || localStorage.getItem(processingKey)) {
        console.log('Callback already processed or processing, skipping...');
        return;
      }

      hasProcessed.current = true;
      localStorage.setItem(processingKey, 'true');

      try {
        // Get code and state from URL
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        const state = params.get('state');
        const error = params.get('error');
        const errorDescription = params.get('error_description');

        if (error) {
          localStorage.removeItem(processingKey);
          throw new Error(`OAuth error: ${error} - ${errorDescription || 'Unknown error'}`);
        }

        if (!code || !state) {
          localStorage.removeItem(processingKey);
          throw new Error('Missing authorization code or state parameter');
        }

        // Handle the callback
        const success = await handleCallback(code, state);

        if (success) {
          // Redirect to home page after successful authentication
          // Keep processing flag until we navigate to prevent duplicate attempts
          setTimeout(() => {
            localStorage.removeItem(processingKey);
            navigate('/', { replace: true });
          }, 1000);
        } else {
          localStorage.removeItem(processingKey);
          throw new Error('Authentication failed');
        }
      } catch (err) {
        console.error('Callback processing error:', err);
        localStorage.removeItem(processingKey);
        setError(err.message);
        setProcessing(false);
      }
    };

    processCallback();
  }, [handleCallback, navigate]);

  if (error) {
    return (
      <div className="callback-container">
        <div className="callback-card error">
          <h2>Authentication Failed</h2>
          <p>{error}</p>
          <button onClick={() => navigate('/', { replace: true })} className="callback-button">
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  if (processing) {
    return (
      <div className="callback-container">
        <div className="callback-card">
          <div className="spinner"></div>
          <h2>Completing Authentication...</h2>
          <p>Please wait while we sign you in.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="callback-container">
      <div className="callback-card success">
        <div className="checkmark">✓</div>
        <h2>Authentication Successful!</h2>
        <p>Redirecting to your dashboard...</p>
      </div>
    </div>
  );
};

export default Callback;
