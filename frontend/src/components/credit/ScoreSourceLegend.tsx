import { Badge } from '@/components/ui/Badge';

export function ScoreSourceLegend() {
  return (
    <div className="flex flex-wrap gap-2">
      <Badge tone="neutral">Deterministic</Badge>
      <Badge tone="brand">0G Compute</Badge>
      <Badge tone="positive">0G Verified</Badge>
    </div>
  );
}
