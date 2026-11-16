import { ExternalLink, RotateCw } from 'lucide-react';
import { toast } from 'sonner';
import { errorMessage } from '@/api/errors';
import { PageHeader } from '@/components/layout/AppShell';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { APP_DOMAIN } from '@/lib/config';
import { hostUrl } from '@/lib/host';
import { useOrganizations, useRetryOrg, useSetOrgStatus, type Organization } from './api';
import { CreateOrganizationDialog } from './CreateOrganizationDialog';
import { OrgStatusBadge } from './OrgStatusBadge';

function OrgActions({ org }: { org: Organization }) {
  const setStatus = useSetOrgStatus();
  const retry = useRetryOrg();
  const onError = (err: unknown) => toast.error(errorMessage(err));

  if (org.status === 'FAILED') {
    return (
      <Button
        size="sm"
        variant="outline"
        disabled={retry.isPending}
        onClick={() => retry.mutate(org.id, { onError })}
      >
        <RotateCw /> {retry.isPending ? 'Retrying…' : 'Retry'}
      </Button>
    );
  }
  if (org.status === 'PROVISIONING') return null;
  const next = org.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
  return (
    <Button
      size="sm"
      variant={next === 'INACTIVE' ? 'outline' : 'default'}
      disabled={setStatus.isPending}
      onClick={() =>
        setStatus.mutate(
          { id: org.id, status: next },
          {
            onSuccess: () => toast.success(`${org.title} ${next === 'ACTIVE' ? 'activated' : 'deactivated'}`),
            onError,
          },
        )
      }
    >
      {next === 'ACTIVE' ? 'Activate' : 'Deactivate'}
    </Button>
  );
}

export function OrganizationsPage() {
  const orgs = useOrganizations();
  return (
    <>
      <PageHeader
        title="Organizations"
        description="Each organization has its own database and address."
        actions={<CreateOrganizationDialog />}
      />
      {orgs.isError && <Alert>{errorMessage(orgs.error)}</Alert>}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Organization</TableHead>
            <TableHead>Owner</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Projects</TableHead>
            <TableHead>Timezone</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orgs.isPending && (
            <TableRow>
              <TableCell colSpan={6} className="text-muted-foreground">
                Loading…
              </TableCell>
            </TableRow>
          )}
          {orgs.data?.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                No organizations yet.
              </TableCell>
            </TableRow>
          )}
          {orgs.data?.map((org) => (
            <TableRow key={org.id}>
              <TableCell>
                <p className="font-medium">{org.title}</p>
                {org.status === 'ACTIVE' ? (
                  <a
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    href={hostUrl({ slug: org.slug }, window.location, APP_DOMAIN, '/login')}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {org.slug}.{APP_DOMAIN} <ExternalLink className="size-3" />
                  </a>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {org.slug}.{APP_DOMAIN}
                  </p>
                )}
                {org.status === 'FAILED' && org.provisionError && (
                  <p className="mt-1 max-w-sm truncate text-xs text-destructive" title={org.provisionError}>
                    {org.provisionError}
                  </p>
                )}
              </TableCell>
              <TableCell>
                <p>{org.owner.name}</p>
                <p className="text-xs text-muted-foreground">{org.owner.email}</p>
              </TableCell>
              <TableCell>
                <OrgStatusBadge status={org.status} />
              </TableCell>
              <TableCell>{org.projectLimit}</TableCell>
              <TableCell className="text-muted-foreground">{org.timezone}</TableCell>
              <TableCell className="text-right">
                <OrgActions org={org} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}
