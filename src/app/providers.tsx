'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@/context/AuthContext';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 30000, retry: 1 } },
  }));
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: { background: '#0D2847', color: '#fff', border: '1px solid #1A4A7A' },
            success: { style: { background: '#16A34A' }, iconTheme: { primary: '#fff', secondary: '#16A34A' } },
            error: { style: { background: '#DC2626' }, iconTheme: { primary: '#fff', secondary: '#DC2626' } },
            loading: { style: { background: '#42A5F5' }, iconTheme: { primary: '#fff', secondary: '#42A5F5' } },
            custom: { style: { background: '#F59E0B' }, iconTheme: { primary: '#fff', secondary: '#F59E0B' } },
          }}
        />
      </AuthProvider>
    </QueryClientProvider>
  );
}
