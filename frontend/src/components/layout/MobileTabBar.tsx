import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { PRIMARY_NAV_ITEMS } from './navigation';

/** Thumb-reachable primary navigation. Replaces the sidebar below the lg breakpoint. */
export function MobileTabBar() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-hairline cd-glass cd-safe-bottom lg:hidden">
      <ul className="grid grid-cols-5">
        {PRIMARY_NAV_ITEMS.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-1 py-2.5 text-2xs font-medium transition-colors',
                  isActive ? 'text-brand-700' : 'text-ink-soft',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      'flex h-7 w-12 items-center justify-center rounded-lg transition-colors',
                      isActive && 'bg-brand-50',
                    )}
                  >
                    <item.icon size={18} />
                  </span>
                  {item.shortLabel}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
