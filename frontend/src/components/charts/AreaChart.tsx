import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export interface AreaPoint {
  label: string;
  value: number;
}

/** Catmull-Rom → cubic bezier, so the trend line reads smooth without overshooting. */
function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

const PADDING = { top: 18, right: 12, bottom: 8, left: 12 };

export function AreaChart({
  data,
  height = 220,
  min,
  max,
  formatValue = (v) => String(v),
  className,
}: {
  data: AreaPoint[];
  height?: number;
  min?: number;
  max?: number;
  formatValue?: (value: number) => string;
  className?: string;
}) {
  const gradientId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);

  // Coordinates are computed in real pixels so the SVG scales without distorting
  // stroke widths or turning the marker dots into ellipses.
  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const observer = new ResizeObserver((entries) => {
      setWidth(entries[0].contentRect.width);
    });

    observer.observe(element);
    setWidth(element.clientWidth);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setHover(null);
  }, [data]);

  const { coords, path, area, lo, hi } = useMemo(() => {
    const values = data.map((d) => d.value);
    const lo = min ?? Math.min(...values, 0);
    const hi = max ?? Math.max(...values, 1);
    const span = hi - lo || 1;

    const innerW = Math.max(width - PADDING.left - PADDING.right, 1);
    const innerH = Math.max(height - PADDING.top - PADDING.bottom, 1);

    const coords = data.map((d, i) => ({
      x: PADDING.left + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW),
      y: PADDING.top + innerH - ((d.value - lo) / span) * innerH,
    }));

    const path = smoothPath(coords);
    const baseline = PADDING.top + innerH;
    const area =
      coords.length > 0
        ? `${path} L ${coords[coords.length - 1].x} ${baseline} L ${coords[0].x} ${baseline} Z`
        : '';

    return { coords, path, area, lo, hi };
  }, [data, width, height, min, max]);

  const active = hover !== null ? data[hover] : null;
  const activeCoord = hover !== null ? coords[hover] : null;

  return (
    <div className={cn('relative w-full', className)}>
      <div ref={containerRef} className="w-full">
        {width > 0 && data.length > 0 ? (
          <svg width={width} height={height} role="img" aria-label="Credit score trend">
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgb(var(--chart-line))" stopOpacity="0.22" />
                <stop offset="100%" stopColor="rgb(var(--chart-line))" stopOpacity="0" />
              </linearGradient>
            </defs>

            {[0, 0.5, 1].map((t) => {
              const y = PADDING.top + (height - PADDING.top - PADDING.bottom) * t;
              return (
                <line
                  key={t}
                  x1={PADDING.left}
                  x2={width - PADDING.right}
                  y1={y}
                  y2={y}
                  stroke="rgb(var(--hairline-soft))"
                  strokeWidth={1}
                />
              );
            })}

            <path d={area} fill={`url(#${gradientId})`} />
            <path
              d={path}
              fill="none"
              stroke="rgb(var(--chart-line))"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {activeCoord ? (
              <g>
                <line
                  x1={activeCoord.x}
                  x2={activeCoord.x}
                  y1={PADDING.top}
                  y2={height - PADDING.bottom}
                  stroke="rgb(var(--hairline-strong))"
                  strokeWidth={1}
                />
                <circle
                  cx={activeCoord.x}
                  cy={activeCoord.y}
                  r={5}
                  fill="rgb(var(--surface))"
                  stroke="rgb(var(--chart-line))"
                  strokeWidth={2.5}
                />
              </g>
            ) : coords.length > 0 ? (
              <circle
                cx={coords[coords.length - 1].x}
                cy={coords[coords.length - 1].y}
                r={4}
                fill="rgb(var(--chart-line))"
              />
            ) : null}

            {data.map((_, i) => {
              const step = width / data.length;
              return (
                <rect
                  key={i}
                  x={i * step}
                  y={0}
                  width={step}
                  height={height}
                  fill="transparent"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                />
              );
            })}
          </svg>
        ) : (
          <div style={{ height }} />
        )}
      </div>

      <div className="mt-2 flex justify-between px-1 text-2xs text-ink-soft">
        <span>{data[0]?.label}</span>
        {data.length > 2 ? <span className="hidden sm:inline">{data[Math.floor(data.length / 2)]?.label}</span> : null}
        <span>{data[data.length - 1]?.label}</span>
      </div>

      <div className="pointer-events-none absolute right-1 top-0 text-2xs text-ink-faint">
        {formatValue(hi)} · {formatValue(lo)}
      </div>

      {active ? (
        <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 rounded-lg bg-brandpanel px-2.5 py-1.5 text-2xs font-medium text-white ring-1 ring-white/10 shadow-pop">
          <span className="tabular">{formatValue(active.value)}</span>
          <span className="ml-1.5 text-brand-200">{active.label}</span>
        </div>
      ) : null}
    </div>
  );
}
