import { LogOut, Menu, X, type LucideIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { NavLink } from 'react-router';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

interface AppShellProps {
  subtitle: string;
  nav: NavItem[];
  user: { name: string; email: string; role?: string };
  onSignOut: () => void;
  children: ReactNode;
}

/** Standard sidebar layout used by the control panel and the tenant app. */
export function AppShell({ subtitle, nav, user, onSignOut, children }: AppShellProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen bg-muted/30 md:grid md:grid-cols-[240px_1fr]">
      {/* Mobile top bar */}
      <header className="flex items-center justify-between border-b bg-sidebar px-4 py-3 md:hidden">
        <Logo subtitle={subtitle} />
        <Button
          variant="ghost"
          size="icon"
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <X /> : <Menu />}
        </Button>
      </header>

      <aside
        className={cn(
          'flex-col border-r border-sidebar-border bg-sidebar md:sticky md:top-0 md:flex md:h-screen',
          open ? 'flex' : 'hidden',
        )}
      >
        <div className="hidden px-4 py-5 md:block">
          <Logo subtitle={subtitle} />
        </div>
        <nav className="flex-1 space-y-1 px-3 py-2" aria-label="Main">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-sidebar-accent text-primary'
                    : 'text-foreground/80 hover:bg-sidebar-accent/60',
                )
              }
            >
              <item.icon className="size-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <div className="mb-2 px-1">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            {user.role && (
              <p className="mt-0.5 text-[11px] font-semibold tracking-wide text-primary uppercase">
                {user.role}
              </p>
            )}
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={onSignOut}>
            <LogOut /> Sign out
          </Button>
        </div>
      </aside>

      <main className="min-w-0 p-4 md:p-8">{children}</main>
    </div>
  );
}

/** Page title row with optional actions on the right. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}
