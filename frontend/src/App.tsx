import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import './i18n';

import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider';
import { TokenSync } from './auth/TokenSync';
import { LocaleSync } from './i18n/LocaleSync';
import { AppRoutes } from './routes';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
});

export function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <MantineProvider>
          <TokenSync />
          <LocaleSync />
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </MantineProvider>
      </QueryClientProvider>
    </AuthProvider>
  );
}
