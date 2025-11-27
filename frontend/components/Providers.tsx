'use client';

import { ThemeProvider } from '@/lib/contexts/ThemeContext';
import { WorkspaceProvider } from '@/lib/contexts/WorkspaceContext';
import { AuthProvider } from '@/lib/contexts/AuthContext';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <WorkspaceProvider>
          {children}
        </WorkspaceProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

