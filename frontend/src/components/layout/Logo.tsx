import { cn } from '@/lib/utils';

export function Logo({
  size = 32,
  inverse,
  className,
}: {
  size?: number;
  inverse?: boolean;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
        <rect
          width="32"
          height="32"
          rx="9"
          fill={inverse ? '#FFFFFF' : 'rgb(var(--logo-bg))'}
        />
        <path
          d="M22.5 11.4A7.2 7.2 0 0 0 9.6 16a7.2 7.2 0 0 0 12.9 4.6"
          stroke={inverse ? '#0E3F4D' : '#3FC0CE'}
          strokeWidth="2.6"
          strokeLinecap="round"
        />
        <circle cx="22.1" cy="16" r="2.1" fill={inverse ? '#16A2B4' : '#7BD9E2'} />
      </svg>
      <span
        className={cn(
          'font-display text-lg font-semibold tracking-tight',
          inverse ? 'text-white' : 'text-ink',
        )}
      >
        Credora
      </span>
    </span>
  );
}
