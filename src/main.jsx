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
import './styles/auth.css'
import './styles/parampara.css'
import './styles/library.css'
import './styles/heritageIntro.css'
import App from './App.jsx'
import { initDataLayer } from './data/people.js'

const rootEl = document.getElementById('root');

// Hydrates PEOPLE/MARRIAGES/contributions defaults from the shared Supabase
// backend before the app ever renders — every view reads those as plain
// synchronous module exports, so rendering first and hydrating after would
// leave a stale/empty tree with nothing to trigger a re-render once the
// fetch resolves.
initDataLayer().finally(() => {
  createRoot(rootEl).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
