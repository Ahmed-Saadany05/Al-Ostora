import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { router } from './app/router';
// Registers Goda's live provider (JPL Horizons + LOLA). Active with VITE_DATA_PROVIDER=live.
import '@/engine';
import './shared/theme/global.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
