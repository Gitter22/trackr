import { BarChart3, Building2, KanbanSquare, ShieldCheck } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { APP_DOMAIN } from '@/lib/config';
import { hostUrl } from '@/lib/host';

const FEATURES = [
  {
    icon: KanbanSquare,
    title: 'Kanban boards',
    text: 'Custom statuses per project. Drag cards across columns.',
  },
  {
    icon: Building2,
    title: 'One workspace per team',
    text: 'Every organization gets its own database and its own address.',
  },
  {
    icon: ShieldCheck,
    title: 'Roles that make sense',
    text: 'Owner, admin, member and viewer. People only see their projects.',
  },
  {
    icon: BarChart3,
    title: 'Know where things stand',
    text: 'Counts by status, overdue work and load per person.',
  },
];

export function MarketingApp() {
  const adminLogin = hostUrl('admin', window.location, APP_DOMAIN, '/login');
  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50 to-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Logo />
        <Button asChild variant="outline">
          <a href={adminLogin}>Admin portal</a>
        </Button>
      </header>

      <main className="mx-auto max-w-6xl px-6">
        <section className="py-20 text-center md:py-28">
          <p className="mx-auto mb-4 w-fit rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-800">
            Project management for teams
          </p>
          <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight md:text-6xl">
            Track every project, <span className="text-primary">task by task</span>.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
            Trcker gives each organization its own workspace with projects, boards, comments and a full
            history of who changed what.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Button asChild size="lg">
              <a href={adminLogin}>Go to admin portal</a>
            </Button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Your team signs in at <span className="font-mono">your-team.{APP_DOMAIN}</span>
          </p>
        </section>

        <section className="grid gap-4 pb-24 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-xl border bg-white p-5 shadow-sm">
              <f.icon className="mb-3 size-6 text-primary" />
              <h2 className="font-semibold">{f.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Trcker
      </footer>
    </div>
  );
}
