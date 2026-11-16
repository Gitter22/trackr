import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { FullPageSpinner } from '@/components/FullPageSpinner';
import { NotFound } from '@/components/NotFound';
import { TenantSessionProvider, type Org } from './session';

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
      <main className="grid min-h-screen place-items-center">
        <h1 className="text-2xl font-semibold">{status.data.title}</h1>
      </main>
    </TenantSessionProvider>
  );
}
