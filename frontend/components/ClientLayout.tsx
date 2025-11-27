'use client';

import { usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar/Sidebar';
import Header from '@/components/Header/Header';
import AuthGate from '@/components/AuthGate';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const publicRoutes = ['/login', '/register'];
  const isPublicRoute = publicRoutes.includes(pathname);

  // For public routes (login/register), don't show sidebar/header
  if (isPublicRoute) {
    return <AuthGate>{children}</AuthGate>;
  }

  // For protected routes, wrap in AuthGate and show sidebar/header
  return (
    <AuthGate>
      <Sidebar />
      <main className="main-content">
        <Header />
        {children}
      </main>
    </AuthGate>
  );
}

