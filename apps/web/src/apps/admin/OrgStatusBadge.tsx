import { Badge } from '@/components/ui/badge';
import type { OrgStatus } from './api';

const VARIANT = {
  ACTIVE: 'success',
  INACTIVE: 'secondary',
  PROVISIONING: 'warning',
  FAILED: 'destructive',
} as const;
const LABEL: Record<OrgStatus, string> = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  PROVISIONING: 'Provisioning',
  FAILED: 'Failed',
};

export function OrgStatusBadge({ status }: { status: OrgStatus }) {
  return <Badge variant={VARIANT[status]}>{LABEL[status]}</Badge>;
}
