import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import Login from './components/auth/Login'
import Callback from './components/auth/Callback'
import Dashboard from './components/dashboard/Dashboard'
import IdentitiesList from './components/identities/IdentitiesList'
import LogViewer from './components/logs/LogViewer'
import Settings from './components/settings/Settings'
import MyAccess from './components/access/MyAccess'
import MyTeam from './components/team/MyTeam'
import AccessRequestsList from './components/access-requests/AccessRequestsList'
import AccessLensPage from './components/access-lens/AccessLensPage'
import Admin from './components/admin/Admin'
import Navbar from './components/layout/Navbar'
import Breadcrumbs from './components/layout/Breadcrumbs'
import AgentChat from './components/dashboard/AgentChat'
import './App.css'

// Layout wrapper for protected routes
const ProtectedLayout = ({ children, title }) => {
  return (
    <div className="app-container">
      <Navbar title={title} />
      <Breadcrumbs />
      <div className="main-content">
        {children}
      </div>
    </div>
  );
};

function App() {
  const { isAuthenticated, isLoading, user, logout, getAccessToken } = useAuth()
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [isChatDocked, setIsChatDocked] = useState(true)

  // Debug: Log auth state
  useEffect(() => {
    console.log('=== App Auth State ===');
    console.log('isLoading:', isLoading);
    console.log('isAuthenticated:', isAuthenticated);
    console.log('user:', user);
  }, [isLoading, isAuthenticated, user]);

  // Loading state
  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <>
      <Routes>
      {/* OAuth Callback Route */}
      <Route path="/callback" element={<Callback />} />

      {/* Protected Routes */}
      <Route
        path="/"
        element={
          isAuthenticated ? (
            <ProtectedLayout title="Welcome">
              <Dashboard />
            </ProtectedLayout>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      {/* Identities List Route */}
      <Route
        path="/identities"
        element={
          isAuthenticated ? (
            <ProtectedLayout title="All Identities">
              <IdentitiesList />
            </ProtectedLayout>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      {/* Log Viewer Route */}
      <Route
        path="/logs"
        element={
          isAuthenticated ? (
            <ProtectedLayout title="API Log Viewer">
              <LogViewer />
            </ProtectedLayout>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      {/* Settings Route */}
      <Route
        path="/settings"
        element={
          isAuthenticated ? (
            <ProtectedLayout title="Settings">
              <Settings />
            </ProtectedLayout>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      {/* My Access Route */}
      <Route
        path="/my-access"
        element={
          isAuthenticated ? (
            <MyAccess />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      {/* My Team Route */}
      <Route
        path="/my-team"
        element={
          isAuthenticated ? (
            <MyTeam />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      {/* Access Requests Route */}
      <Route
        path="/access-requests"
        element={
          isAuthenticated ? (
            <ProtectedLayout title="Access Requests">
              <AccessRequestsList />
            </ProtectedLayout>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      {/* Access Lens Route */}
      <Route
        path="/access-lens"
        element={
          isAuthenticated ? (
            <AccessLensPage />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      {/* Admin Route */}
      <Route
        path="/admin"
        element={
          isAuthenticated ? (
            <ProtectedLayout title="Administration">
              <Admin />
            </ProtectedLayout>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      {/* Login Route */}
      <Route
        path="/login"
        element={!isAuthenticated ? <Login /> : <Navigate to="/" replace />}
      />

      {/* Catch all - redirect to home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>

    {/* Global Agent Chat - Available on all pages when authenticated */}
    {isAuthenticated && (
      <>
        {/* Floating Agent Button */}
        <button
          className={`agent-float-btn ${isChatOpen ? 'chat-open' : ''}`}
          onClick={() => setIsChatOpen(true)}
          title="Open IGAgent Assistant"
        >
          👾
        </button>

        {/* Agent Chat */}
        <AgentChat
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          isDocked={isChatDocked}
          onToggleDock={() => setIsChatDocked(!isChatDocked)}
        />
      </>
    )}
    </>
  )
}

export default App
