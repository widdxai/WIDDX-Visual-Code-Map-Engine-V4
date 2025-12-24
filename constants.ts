
export const WIDDX_COLOR_PALETTE = {
  background: '#121212', // Charcoal Black
  surface: '#18181b',    // Zinc 900
  border: '#27272a',     // Zinc 800
  primary: '#8b5cf6',    // Violet 500
  success: '#10b981',    // Emerald 500
  warning: '#f59e0b',    // Amber 500
  error: '#ef4444',      // Red 500
  textPrimary: '#f4f4f5', // Zinc 100
  textSecondary: '#a1a1aa' // Zinc 400
};

export const WIDDX_AUDIT_FILENAME = '/WIDDX_AUDIT.md';

export const WIDDX_DEMO_FILES = [
  {
    path: '/package.json',
    content: `
{
  "name": "widdx-demo",
  "dependencies": {
    "react": "^18.0.0"
  }
}
    `
  },
  {
    path: '/src/index.js',
    content: `
import App from './App';
import { reportWebVitals } from './utils/analytics';

console.log("Starting App");
App.init();
reportWebVitals();
    `
  },
  {
    path: '/src/App.js',
    content: `
import Header from './components/Header';
import Footer from './components/Footer';
import { API_URL } from './config';

export default {
  init: () => {
    console.log("App Initialized with " + API_URL);
    Header.render();
  }
}
    `
  },
  {
    path: '/src/components/Header.js',
    content: `
import Logo from './Logo';
export default { render: () => console.log("Header") }
    `
  },
  {
    path: '/src/components/Footer.js',
    content: `
export default { render: () => console.log("Footer") }
    `
  },
  {
    path: '/src/components/Logo.js',
    content: `
export default "LogoSVG"
    `
  },
  {
    path: '/src/utils/analytics.js',
    content: `
export const reportWebVitals = () => console.log("Vitals");
    `
  },
  {
    path: '/src/config.js',
    content: `
export const API_URL = "https://api.widdx.com";
    `
  },
  {
    path: '/src/unused/OldFeature.js',
    content: `
import { API_URL } from '../config';
// This file is an orphan
    `
  },
  {
    path: '/src/broken/DeadLink.js',
    content: `
import { API_URL } from '../config'; 
// Fixed broken link
    `
  }
];

// --- VISUALIZER THEMES ---
export const THEMES: Record<string, any> = {
  ENGINEERING: {
    id: 'ENGINEERING',
    name: 'Violet Prime',
    colors: {
      UI: '#a78bfa',      // Violet 400
      LOGIC: '#8b5cf6',   // Violet 500 (Primary)
      DATA: '#c084fc',    // Purple 400
      CORE: '#7c3aed',    // Violet 600
      FOLDER: '#27272a',  // Zinc 800
      FOLDER_STROKE: '#52525b',
      MISSING: '#ef4444',
      BG: '#121212',      // Charcoal
      TEXT: '#f4f4f5',
      LINK_STRUC: '#3f3f46',
      LINK_DEP: '#8b5cf6' // Violet links
    }
  },
  CYBER: {
    id: 'CYBER',
    name: 'Neon Core',
    colors: {
      UI: '#d946ef', LOGIC: '#22d3ee', DATA: '#f472b6', CORE: '#8b5cf6',
      FOLDER: '#4c1d95', FOLDER_STROKE: '#7c3aed', MISSING: '#ff0055',
      BG: '#05030a', TEXT: '#e879f9',
      LINK_STRUC: '#2e1065', LINK_DEP: '#06b6d4'
    }
  },
  MONO: {
    id: 'MONO',
    name: 'Ink & Paper',
    colors: {
      UI: '#475569', LOGIC: '#475569', DATA: '#475569', CORE: '#0f172a',
      FOLDER: '#e2e8f0', FOLDER_STROKE: '#94a3b8', MISSING: '#dc2626',
      BG: '#ffffff', TEXT: '#334155',
      LINK_STRUC: '#cbd5e1', LINK_DEP: '#000000'
    }
  }
};
