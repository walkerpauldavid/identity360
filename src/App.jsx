import { useState, useEffect, lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import Login from './components/auth/Login'
import Callback from './components/auth/Callback'
import Navbar from './components/layout/Navbar'
import Breadcrumbs from './components/layout/Breadcrumbs'
import './App.css'

// Lazy-loaded page components — split into separate chunks for faster initial load
const Dashboard = lazy(() => import('./components/dashboard/Dashboard'))
const IdentitiesList = lazy(() => import('./components/identities/IdentitiesList'))
const LogViewer = lazy(() => import('./components/logs/LogViewer'))
const Settings = lazy(() => import('./components/settings/Settings'))
const MyAccess = lazy(() => import('./components/access/MyAccess'))
const MyTeam = lazy(() => import('./components/team/MyTeam'))
const AccessRequestsList = lazy(() => import('./components/access-requests/AccessRequestsList'))
const AccessLensPage = lazy(() => import('./components/access-lens/AccessLensPage'))
const Admin = lazy(() => import('./components/admin/Admin'))
const AgentChat = lazy(() => import('./components/dashboard/AgentChat'))

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
      <Suspense fallback={<div className="loading-container"><div className="spinner"></div><p>Loading...</p></div>}>
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

      {/* Identity360 Route */}
      <Route
        path="/identity360"
        element={
          isAuthenticated ? (
            <AccessLensPage />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      {/* Legacy /access-lens route redirect to /identity360 */}
      <Route
        path="/access-lens"
        element={<Navigate to="/identity360" replace />}
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
      </Suspense>

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
