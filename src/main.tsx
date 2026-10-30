import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/charts/styles.css';
import '@mantine/dropzone/styles.css';
import './styles.css';
import './i18n';
import { theme } from './theme';
import { AuthProvider } from './auth/AuthContext';
import App from './App';
import { UpdatePrompt } from './components/UpdatePrompt';

const queryClient = new QueryClient({ defaultOptions: {
  queries: { refetchOnWindowFocus: false, retry: 1 },
  // Writes fail immediately when offline (with a toast) instead of silently replaying later.
  mutations: { networkMode: 'always' },
} });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="auto">
      <Notifications position="top-right" />
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <App />
            <UpdatePrompt />
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </MantineProvider>
  </React.StrictMode>,
);
