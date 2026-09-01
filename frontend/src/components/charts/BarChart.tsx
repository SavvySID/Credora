import { cn } from '@/lib/utils';

export interface BarDatum {
  label: string;
  value: number;
  highlight?: boolean;
}

export function BarChart({
  data,
  height = 160,
  formatValue = (v) => String(v),
  className,
}: {
  data: BarDatum[];
  height?: number;
  formatValue?: (value: number) => string;
  className?: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-end gap-2" style={{ height }}>
        {data.map((datum) => {
          const pct = (datum.value / max) * 100;
          return (
            <div key={datum.label} className="group flex flex-1 flex-col items-center gap-2">
              <div className="relative flex w-full flex-1 items-end">
                <div
                  className={cn(
                    'w-full rounded-t-md transition-all duration-500 ease-smooth',
                    datum.highlight
                      ? 'bg-gradient-to-t from-viz-1 to-viz-3'
                      : 'bg-surface-inset group-hover:bg-edge-brand',
                  )}
                  style={{ height: `${Math.max(pct, 2)}%` }}
                />
                <span className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-brandpanel px-1.5 py-0.5 text-2xs font-medium tabular text-white opacity-0 ring-1 ring-white/10 transition-opacity group-hover:opacity-100">
                  {formatValue(datum.value)}
                </span>
              </div>
              <span className="text-2xs text-ink-soft">{datum.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function Sparkline({
  values,
  width = 96,
  height = 28,
  tone = 'rgb(var(--chart-line))',
  className,
}: {
  values: number[];
  width?: number;
  height?: number;
  tone?: string;
  className?: string;
}) {
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const points = values
    .map((value, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = height - ((value - min) / span) * height;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg width={width} height={height} className={cn('overflow-visible', className)} aria-hidden>
      <polyline
        points={points}
        fill="none"
        stroke={tone}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
