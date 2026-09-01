import { Monitor, Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme, type ThemePreference } from '@/contexts/ThemeContext';

/**
 * Single-tap light/dark switch for the app chrome.
 *
 * The icon shows the theme you would move *to*, which is the convention users
 * expect from OS-level switches. Both icons are always mounted so the swap can
 * cross-fade instead of popping.
 */
export function ThemeToggle({
  className,
  tooltipAlign = 'center',
}: {
  className?: string;
  tooltipAlign?: 'center' | 'right';
}) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const label = isDark ? 'Switch to light mode' : 'Switch to dark mode';

  return (
    <div className={cn('group relative', className)}>
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={label}
        aria-pressed={isDark}
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-hairline bg-surface text-ink-muted transition-colors hover:border-hairline-strong hover:text-ink"
      >
        <span className="relative block h-[18px] w-[18px]">
          <Sun
            size={18}
            aria-hidden
            className={cn(
              'absolute inset-0 transition-all duration-300 ease-smooth',
              isDark ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-50 opacity-0',
            )}
          />
          <Moon
            size={18}
            aria-hidden
            className={cn(
              'absolute inset-0 transition-all duration-300 ease-smooth',
              isDark ? 'rotate-90 scale-50 opacity-0' : 'rotate-0 scale-100 opacity-100',
            )}
          />
        </span>
      </button>

      <span
        role="tooltip"
        className={cn(
          'pointer-events-none absolute top-full z-50 mt-2 whitespace-nowrap rounded-lg border border-hairline bg-surface px-2.5 py-1.5 text-2xs font-medium text-ink-muted opacity-0 shadow-pop transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100',
          tooltipAlign === 'right' ? 'right-0' : 'left-1/2 -translate-x-1/2',
        )}
      >
        {label}
      </span>
    </div>
  );
}

const OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

/** Explicit three-way control, including the "follow my OS" option. */
export function ThemeSelect({ className }: { className?: string }) {
  const { preference, setPreference } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Appearance"
      className={cn(
        'inline-flex items-center gap-1 rounded-xl border border-hairline bg-surface-inset p-1',
        className,
      )}
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = preference === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setPreference(value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all',
              active
                ? 'bg-surface text-ink shadow-card'
                : 'text-ink-soft hover:text-ink-muted',
            )}
          >
            <Icon size={14} aria-hidden />
            {label}
          </button>
        );
      })}
    </div>
  );
}
