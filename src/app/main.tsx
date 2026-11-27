import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { I18nProvider } from '../config/i18n';
import { AuthUserProvider } from '../core/providers/AuthUserProvider';
import { initMessagingStorage } from '../core/services/messageService';
import ErrorBoundary from '../shared/layout/ErrorBoundary';

import '../index.css';
import '../styles/pwa-style.css';
import '../styles/payment-style.css';
import '../styles/audio-style.css';
import '../styles/follow-style.css';
import '../styles/recommendation-style.css';
import '../styles/awards-style.css';
import '../styles/collaboration-style.css';
import '../styles/supervisor-workspace-style.css';
import '../styles/supervisor-events-style.css';
import '../styles/group-style.css';
import '../styles/fixes-p0.css';
import '../styles/mobile/index.css';
import '../styles/tablet.css';
import '../styles/supervisor-missing-style.css';
import '../styles/cover-style.css';

// En production uniquement : on masque les logs de la console du navigateur.
// En développement on les garde, sinon les vrais bugs deviennent invisibles.
if (import.meta.env.PROD) {
  const noop = () => {};
  console.log = noop;
  console.info = noop;
  console.warn = noop;
  console.error = noop;
  console.debug = noop;
}

try {
  initMessagingStorage();
} catch (err) {
  console.error('[messaging] init failed:', err);
}

if (import.meta.env.PROD) {
  import('virtual:pwa-register')
    .then(({ registerSW }) => {
      registerSW({
        immediate: true,
        onNeedRefresh() {
          console.info('[PWA] New version available — reload to update');
        },
        onOfflineReady() {
          console.log('[PWA] App ready offline');
        },
      });
    })
    .catch(() => { });
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        if (error?.status === 401 || error?.status === 429) return false;
        return failureCount < 2;
      },
      staleTime: 1000 * 60 * 5,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <I18nProvider>
          <AuthUserProvider>
            <BrowserRouter
              future={{
                v7_startTransition: true,
                v7_relativeSplatPath: true,
              }}
            >
              <App />
            </BrowserRouter>
          </AuthUserProvider>
        </I18nProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
