import { AdminApp } from '@/apps/admin/AdminApp';
import { MarketingApp } from '@/apps/marketing/MarketingApp';
import { TenantApp } from '@/apps/tenant/TenantApp';
import { NotFound } from '@/components/NotFound';
import { APP_DOMAIN } from '@/lib/config';
import { parseHost } from '@/lib/host';

/** One bundle, three apps: the hostname decides which one runs. */
export function App({ hostname = window.location.hostname }: { hostname?: string }) {
  const host = parseHost(hostname, APP_DOMAIN);
  switch (host.kind) {
    case 'marketing':
      return <MarketingApp />;
    case 'admin':
      return <AdminApp />;
    case 'tenant':
      return <TenantApp slug={host.slug} />;
    default:
      return <NotFound message="This address isn't part of Trcker." />;
  }
}
