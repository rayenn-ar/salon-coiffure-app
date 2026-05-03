'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect, ReactNode } from 'react';
import { useAuthStore } from './store';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
          },
        },
      })
  );

  // Rehydrate the Zustand auth store from localStorage once on the client.
  // This must happen before any protected page reads token/user, so we do it
  // here in the root Providers wrapper (which mounts before children).
  useEffect(() => {
    useAuthStore.persist.rehydrate();
    useAuthStore.getState().setHasHydrated(true);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
