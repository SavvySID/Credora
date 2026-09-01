import { BadgeCheck } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/Feedback';

export interface EarnedBadge {
  id: string;
  label: string;
  evidence: string;
}

export function ReputationRow({ badges }: { badges: EarnedBadge[] }) {
  if (badges.length === 0) {
    return (
      <EmptyState
        icon={<BadgeCheck className="h-5 w-5" />}
        title="No reputation badges yet"
        description="Badges appear only when the underlying on-chain or 0G-verified condition is met."
        className="py-6"
      />
    );
  }

  return (
    <ul className="flex flex-wrap gap-2">
      {badges.map((badge) => (
        <li key={badge.id}>
          <span title={badge.evidence}>
            <Badge tone="positive" icon={<BadgeCheck className="h-3 w-3" />}>
              {badge.label}
            </Badge>
          </span>
        </li>
      ))}
    </ul>
  );
}
