import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { FolderKanban, Users } from 'lucide-react';
import { useState } from 'react';
import { createBrowserRouter, Navigate, Outlet, RouterProvider } from 'react-router';
import { FullPageSpinner } from '@/components/FullPageSpinner';
import { AppShell } from '@/components/layout/AppShell';
import { NotFound } from '@/components/NotFound';
import { TenantLoginPage } from './LoginPage';
import { ProjectPage } from './projects/ProjectPage';
import { ProjectsPage } from './projects/ProjectsPage';
import { TenantSessionProvider, useTenantSession, type Org } from './session';
import { UsersPage } from './users/UsersPage';

const NAV = [
  { to: '/projects', label: 'Projects', icon: FolderKanban },
  { to: '/users', label: 'Users', icon: Users },
];

/** Signed-in layout. No token -> /login; a 401 anywhere clears the token (see session). */
function TenantLayout({ org }: { org: Org }) {
  const { token, user, loading, signOut } = useTenantSession();
  if (!token) return <Navigate to="/login" replace />;
  if (loading || !user) return <FullPageSpinner />;
  return (
    <AppShell
      subtitle={org.title}
      nav={NAV}
      user={{ name: user.name, email: user.email, role: user.role.toLowerCase() }}
      onSignOut={signOut}
    >
      <Outlet />
    </AppShell>
  );
}

const createRouter = (org: Org) =>
  createBrowserRouter([
    { path: '/login', element: <TenantLoginPage orgTitle={org.title} /> },
    {
      element: <TenantLayout org={org} />,
      children: [
        { index: true, element: <Navigate to="/projects" replace /> },
        { path: '/projects', element: <ProjectsPage /> },
        { path: '/projects/:projectId/*', element: <ProjectPage /> },
        { path: '/users', element: <UsersPage /> },
        { path: '*', element: <Navigate to="/projects" replace /> },
      ],
    },
  ]);

function TenantRouter({ org }: { org: Org }) {
  const [router] = useState(() => createRouter(org));
  return <RouterProvider router={router} />;
}

/** Checks the subdomain is an active tenant before showing anything (404 otherwise). */
export function TenantApp({ slug }: { slug: string }) {
  const status = useQuery({
    queryKey: ['tenant-status', slug],
    queryFn: async () => (await axios.get<{ org: Org }>('/api/tenant/status')).data.org,
  });
  if (status.isPending) return <FullPageSpinner />;
  if (status.isError) return <NotFound />;
  return (
    <TenantSessionProvider slug={slug}>
      <TenantRouter org={status.data} />
    </TenantSessionProvider>
  );
}
