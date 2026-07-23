import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'leaflet/dist/leaflet.css'
import './styles/global.css'
import './styles/cover.css'
import './styles/banyan.css'
import './styles/classicTree.css'
import './styles/folio.css'
import './styles/contribute.css'
import './styles/treasury.css'
import './styles/vault.css'
import './styles/journeyMap.css'
import './styles/admin.css'
import './styles/biography.css'
import './styles/familyBuilder.css'
import './styles/interview.css'
import './styles/welcomeIntro.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
