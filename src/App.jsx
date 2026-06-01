import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Box } from '@mui/material'
import Navbar from './components/Navbar'
import HomePage from './pages/HomePage'
import RecipeDetailPage from './pages/RecipeDetailPage'
import CreateEditRecipePage from './pages/CreateEditRecipePage'
import SendRecipePage from './pages/SendRecipePage'
import { useAuthStore } from './store/authStore'
import { loadGsiScript, initTokenClient } from './services/googleAuth'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

function ProtectedRoute({ children }) {
  const { isSignedIn } = useAuthStore()
  return isSignedIn ? children : <Navigate to="/" replace />
}

export default function App() {
  const { isTokenValid } = useAuthStore()

  useEffect(() => {
    if (!CLIENT_ID || CLIENT_ID === 'your-client-id.apps.googleusercontent.com') {
      console.warn('VITE_GOOGLE_CLIENT_ID not set. See GOOGLE_SETUP.md.')
      return
    }
    loadGsiScript()
      .then(() => initTokenClient(CLIENT_ID))
      .catch((err) => console.error('Failed to load Google Sign-In:', err))
  }, [])

  return (
    <BrowserRouter>
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
        <Navbar />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route
            path="/recipe/new"
            element={<ProtectedRoute><CreateEditRecipePage /></ProtectedRoute>}
          />
          <Route
            path="/recipe/:id/edit"
            element={<ProtectedRoute><CreateEditRecipePage /></ProtectedRoute>}
          />
          <Route
            path="/recipe/:id"
            element={<ProtectedRoute><RecipeDetailPage /></ProtectedRoute>}
          />
          <Route
            path="/send"
            element={<ProtectedRoute><SendRecipePage /></ProtectedRoute>}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Box>
    </BrowserRouter>
  )
}
