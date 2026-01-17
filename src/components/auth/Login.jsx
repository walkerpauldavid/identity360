/**
 * Login Component
 * Displays login UI and initiates OAuth2 flow
 */

import { useAuth } from '../../contexts/AuthContext';
import { authService } from '../../services/authService';
import './Login.css';

const Login = () => {
  const { login, error } = useAuth();

  const handleLogin = async () => {
    try {
      console.log('=== Login button clicked ===');
      console.log('Attempting to initiate OAuth flow...');
      await login();
      console.log('If you see this message, the redirect may have been blocked');
    } catch (err) {
      // Error is already handled in context
      console.error('=== Login error caught ===');
      console.error('Error details:', err);
      alert(`Login failed: ${err.message}\n\nCheck the browser console (F12) for more details.`);
    }
  };

  const handleClearAuth = () => {
    console.log('=== Clearing all authentication data ===');
    // Clear all OAuth-related data
    localStorage.removeItem('oauth_token_data');
    localStorage.removeItem('oauth_state');
    localStorage.removeItem('oauth_code_verifier');
    localStorage.removeItem('oauth_callback_processing');
    localStorage.removeItem('bearer_token_override');
    console.log('All auth data cleared');
    alert('All authentication data cleared. Please try signing in again.');
    window.location.reload();
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>Omada Identity Management</h1>
        <p>Please sign in to access your identity and access management dashboard.</p>

        {error && (
          <div className="login-error">
            <strong>Authentication Error:</strong> {error}
          </div>
        )}

        <button onClick={handleLogin} className="login-button">
          Sign in with Microsoft
        </button>

        <div className="login-info">
          <p>This application uses OAuth 2.0 with PKCE for secure authentication.</p>
          <p>You'll be redirected to Microsoft's login page.</p>
        </div>

        <div className="login-troubleshoot">
          <p>Having trouble signing in?</p>
          <button onClick={handleClearAuth} className="clear-auth-button">
            Clear Authentication Data
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
