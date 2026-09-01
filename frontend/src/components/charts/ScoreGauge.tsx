import { useEffect, useId, useState } from 'react';
import { cn } from '@/lib/utils';
import { SCORE_MAX, type Tone } from '@/lib/credit';

// Gradient stops read from theme variables so the gauge stays legible on both canvases.
const STROKES: Record<Tone, [string, string]> = {
  positive: ['rgb(var(--positive-500))', '#3FC0CE'],
  caution: ['rgb(var(--caution-500))', '#3FC0CE'],
  critical: ['rgb(var(--critical-500))', '#3FC0CE'],
  brand: ['#0D8298', '#7BD9E2'],
  neutral: ['rgb(var(--ink-faint))', 'rgb(var(--hairline-strong))'],
};

/** Polar → cartesian for a 270° gauge that opens at the bottom. */
function point(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number) {
  const start = point(cx, cy, r, 135);
  const end = point(cx, cy, r, 405);
  return `M ${start.x} ${start.y} A ${r} ${r} 0 1 1 ${end.x} ${end.y}`;
}

export function ScoreGauge({
  score,
  tone = 'brand',
  size = 240,
  label,
  caption,
  animate = true,
  className,
}: {
  score: number;
  tone?: Tone;
  size?: number;
  label?: string;
  caption?: string;
  animate?: boolean;
  className?: string;
}) {
  const gradientId = useId();
  const [display, setDisplay] = useState(animate ? 0 : score);

  // Count the score up on mount/change so the headline figure feels alive.
  useEffect(() => {
    if (!animate) {
      setDisplay(score);
      return;
    }

    const duration = 900;
    const start = performance.now();
    const from = 0;
    let frame = 0;

    const step = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (score - from) * eased));
      if (t < 1) frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [score, animate]);

  const stroke = size >= 200 ? 14 : 10;
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - stroke) / 2 - 2;
  const pct = Math.max(0, Math.min(1, score / SCORE_MAX)) * 100;
  const [from, to] = STROKES[tone];

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Credit score ${score} of ${SCORE_MAX}`}>
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={from} />
            <stop offset="100%" stopColor={to} />
          </linearGradient>
        </defs>

        <path
          d={arcPath(cx, cy, r)}
          fill="none"
          stroke="rgb(var(--surface-inset))"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        <path
          d={arcPath(cx, cy, r)}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={`${pct} 100`}
          style={{ transition: 'stroke-dasharray 1s cubic-bezier(0.22, 1, 0.36, 1)' }}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="font-display text-5xl font-semibold tabular tracking-tight text-ink">
          {display}
        </span>
        <span className="mt-0.5 text-xs font-medium text-ink-soft">of {SCORE_MAX}</span>
        {label ? (
          <span className="mt-2 text-sm font-semibold text-ink">{label}</span>
        ) : null}
        {caption ? <span className="mt-0.5 text-2xs text-ink-soft">{caption}</span> : null}
      </div>
    </div>
  );
}
