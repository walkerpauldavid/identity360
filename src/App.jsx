import { useState, useEffect, lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { usePreferences } from './contexts/PreferencesContext'
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

// Reusable loading spinner for per-route Suspense fallbacks
const RouteLoader = ({ message = 'Loading...' }) => (
  <div className="loading-container">
    <div className="spinner"></div>
    <p>{message}</p>
  </div>
)

// Layout wrapper for protected routes
const ProtectedLayout = ({ children, title }) => {
  const { preferences } = usePreferences();
  const currentTheme = preferences.theme || 'light';

  return (
    <div className={`app-container theme-${currentTheme}`}>
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
        {/* OAuth Callback Route - not lazy loaded */}
        <Route path="/callback" element={<Callback />} />

        {/* Protected Routes - each with individual Suspense boundary */}
        <Route
          path="/"
          element={
            isAuthenticated ? (
              <ProtectedLayout title="Welcome">
                <Suspense fallback={<RouteLoader message="Loading dashboard..." />}>
                  <Dashboard />
                </Suspense>
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
                <Suspense fallback={<RouteLoader message="Loading identities..." />}>
                  <IdentitiesList />
                </Suspense>
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
                <Suspense fallback={<RouteLoader message="Loading logs..." />}>
                  <LogViewer />
                </Suspense>
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
                <Suspense fallback={<RouteLoader message="Loading settings..." />}>
                  <Settings />
                </Suspense>
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
              <Suspense fallback={<RouteLoader message="Loading my access..." />}>
                <MyAccess />
              </Suspense>
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
              <Suspense fallback={<RouteLoader message="Loading my team..." />}>
                <MyTeam />
              </Suspense>
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
                <Suspense fallback={<RouteLoader message="Loading access requests..." />}>
                  <AccessRequestsList />
                </Suspense>
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
              <Suspense fallback={<RouteLoader message="Loading Identity360..." />}>
                <AccessLensPage />
              </Suspense>
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
                <Suspense fallback={<RouteLoader message="Loading admin..." />}>
                  <Admin />
                </Suspense>
              </ProtectedLayout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        {/* Login Route - not lazy loaded */}
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
          <Suspense fallback={null}>
            <AgentChat
              isOpen={isChatOpen}
              onClose={() => setIsChatOpen(false)}
              isDocked={isChatDocked}
              onToggleDock={() => setIsChatDocked(!isChatDocked)}
            />
          </Suspense>
        </>
      )}
    </>
  )
}

export default App
