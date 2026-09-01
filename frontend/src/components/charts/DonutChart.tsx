import { cn } from '@/lib/utils';

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

export function DonutChart({
  slices,
  size = 168,
  thickness = 18,
  centerLabel,
  centerValue,
  className,
}: {
  slices: DonutSlice[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
  className?: string;
}) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0) || 1;
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;

  let offset = 0;

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Distribution">
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgb(var(--surface-inset))"
            strokeWidth={thickness}
          />
          {slices.map((slice) => {
            const fraction = slice.value / total;
            const dash = fraction * circumference;
            // 2px visual gap between adjacent slices.
            const gap = slices.length > 1 ? 2 : 0;
            const element = (
              <circle
                key={slice.label}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={slice.color}
                strokeWidth={thickness}
                strokeLinecap="round"
                strokeDasharray={`${Math.max(dash - gap, 0)} ${circumference - Math.max(dash - gap, 0)}`}
                strokeDashoffset={-offset}
              />
            );
            offset += dash;
            return element;
          })}
        </g>
      </svg>

      {centerValue || centerLabel ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          {centerValue ? (
            <span className="font-display text-2xl font-semibold tabular tracking-tight">
              {centerValue}
            </span>
          ) : null}
          {centerLabel ? (
            <span className="mt-0.5 text-2xs uppercase tracking-wider text-ink-soft">
              {centerLabel}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function DonutLegend({ slices, total }: { slices: DonutSlice[]; total?: number }) {
  const sum = total ?? slices.reduce((acc, slice) => acc + slice.value, 0) ?? 1;

  return (
    <ul className="space-y-3">
      {slices.map((slice) => (
        <li key={slice.label} className="flex items-center justify-between gap-4">
          <span className="flex min-w-0 items-center gap-2.5">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: slice.color }}
            />
            <span className="truncate text-sm text-ink-muted">{slice.label}</span>
          </span>
          <span className="shrink-0 text-sm font-semibold tabular">
            {sum ? Math.round((slice.value / sum) * 100) : 0}%
          </span>
        </li>
      ))}
    </ul>
  );
}
