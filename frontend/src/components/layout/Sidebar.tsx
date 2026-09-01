import { NavLink, Link } from 'react-router-dom';
import { ArrowUpRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NAV_SECTIONS } from './navigation';
import { Logo } from './Logo';
import { useCredit } from '@/contexts/CreditContext';

function ServiceDot({ online }: { online: boolean }) {
  return (
    <span
      className={cn(
        'h-1.5 w-1.5 rounded-full',
        online ? 'bg-positive-500' : 'bg-ink-faint',
      )}
    />
  );
}

/**
 * Compact infrastructure readout. 0G sits at the bottom of the nav as supporting
 * infrastructure rather than as a headline feature.
 */
function InfrastructurePanel() {
  const { zeroGStatus } = useCredit();

  const services = [
    { name: 'Storage', online: zeroGStatus.storageOnline || zeroGStatus.initialized },
    { name: 'Compute', online: zeroGStatus.computeOnline },
    { name: 'Stream', online: zeroGStatus.pipelineConnected },
  ];

  return (
    <div className="rounded-xl border border-hairline bg-surface-muted p-3.5">
      <div className="flex items-center justify-between">
        <span className="text-2xs font-semibold uppercase tracking-wider text-ink-soft">
          0G Network
        </span>
        <span className="text-2xs font-medium text-ink-soft">
          {services.filter((s) => s.online).length}/3
        </span>
      </div>
      <ul className="mt-2.5 space-y-1.5">
        {services.map((service) => (
          <li key={service.name} className="flex items-center justify-between text-xs">
            <span className="text-ink-muted">{service.name}</span>
            <ServiceDot online={service.online} />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center justify-between px-5">
        <Link to="/" onClick={onNavigate} aria-label="Credora home">
          <Logo />
        </Link>
        {onNavigate ? (
          <button
            type="button"
            onClick={onNavigate}
            aria-label="Close navigation"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-soft hover:bg-surface-inset lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title}>
            <p className="px-2 pb-2 text-2xs font-semibold uppercase tracking-wider text-ink-faint">
              {section.title}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ease-smooth',
                        isActive
                          ? 'bg-brandsolid text-brandsolid-fg shadow-card'
                          : 'text-ink-muted hover:bg-surface-inset hover:text-ink',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <item.icon
                          size={18}
                          className={cn(
                            'shrink-0',
                            isActive ? 'opacity-70' : 'text-ink-soft group-hover:text-ink',
                          )}
                        />
                        <span className="truncate">{item.label}</span>
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 space-y-3 px-3 pb-4">
        <InfrastructurePanel />
        <Link
          to="/"
          onClick={onNavigate}
          className="flex items-center justify-between rounded-xl px-3 py-2 text-xs font-medium text-ink-soft transition-colors hover:bg-surface-inset hover:text-ink"
        >
          About Credora
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] border-r border-hairline bg-surface lg:block">
      <SidebarContent />
    </aside>
  );
}

export function MobileSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div
        className="absolute inset-0 animate-fade-in bg-brand-950/40 backdrop-blur-sm dark:bg-black/65"
        onClick={onClose}
      />
      <div className="absolute inset-y-0 left-0 w-[280px] max-w-[85vw] animate-slide-in-right border-r border-hairline bg-surface shadow-pop">
        <SidebarContent onNavigate={onClose} />
      </div>
    </div>
  );
}
