// Vite/React entry point — mounts <App /> (which sets up AuthProvider and
// routing) into the #root div in index.html. Nothing app-specific lives
// here; this file rarely needs to change.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  // StrictMode double-invokes effects/renders in development only, to help
  // surface side-effect bugs early — it's a no-op in production builds.
  <StrictMode>
    <App />
  </StrictMode>,
)
