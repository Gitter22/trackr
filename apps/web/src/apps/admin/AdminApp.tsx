import { Building2, Users } from 'lucide-react';
import { useState } from 'react';
import { createBrowserRouter, Navigate, Outlet, RouterProvider, useNavigate } from 'react-router';
import { FullPageSpinner } from '@/components/FullPageSpinner';
import { AppShell } from '@/components/layout/AppShell';
import { useAdminLogout, useAdminMe } from './api';
import { AdminLoginPage } from './LoginPage';
import { OrganizationsPage } from './OrganizationsPage';
import { UsersPage } from './UsersPage';

const NAV = [
  { to: '/organizations', label: 'Organizations', icon: Building2 },
  { to: '/users', label: 'Users', icon: Users },
];

/** Signed-in layout; sends signed-out visitors to /login. */
function AdminLayout() {
  const me = useAdminMe();
  const logout = useAdminLogout();
  const navigate = useNavigate();
  if (me.isPending) return <FullPageSpinner />;
  if (!me.data) return <Navigate to="/login" replace />;
  return (
    <AppShell
      subtitle="Control panel"
      nav={NAV}
      user={{ name: me.data.name, email: me.data.email, role: 'Super admin' }}
      onSignOut={() => logout.mutate(undefined, { onSuccess: () => navigate('/login') })}
    >
      <Outlet />
    </AppShell>
  );
}

const createRouter = () =>
  createBrowserRouter([
    { path: '/login', element: <AdminLoginPage /> },
    {
      element: <AdminLayout />,
      children: [
        { index: true, element: <Navigate to="/organizations" replace /> },
        { path: '/organizations', element: <OrganizationsPage /> },
        { path: '/users', element: <UsersPage /> },
        { path: '*', element: <Navigate to="/organizations" replace /> },
      ],
    },
  ]);

export function AdminApp() {
  const [router] = useState(createRouter);
  return <RouterProvider router={router} />;
}
