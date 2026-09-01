import { Badge, VerifiedBadge } from '@/components/ui/Badge';
import type { VerificationState } from '@/services/api';

export function VerificationStatusBadge({
  status,
}: {
  status: VerificationState['status'] | string | null | undefined;
}) {
  if (status === 'verified') return <VerifiedBadge />;
  if (status === 'pending') return <Badge tone="caution">Pending</Badge>;
  if (status === 'failed') return <Badge tone="critical">Failed</Badge>;
  return <Badge tone="neutral">Unverified</Badge>;
}
