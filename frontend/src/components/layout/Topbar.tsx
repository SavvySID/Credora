import { Menu, RefreshCw } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ALL_NAV_ITEMS } from './navigation';
import { ConnectWallet } from '@/components/wallet/WalletChip';
import { Badge } from '@/components/ui/Badge';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useCredit } from '@/contexts/CreditContext';
import { useWallet } from '@/hooks/useWallet';

export function Topbar({ onOpenNav }: { onOpenNav: () => void }) {
  const location = useLocation();
  const { isConnected } = useWallet();
  const { isRefreshingScore, isRunningAi, refresh, isRealTimeConnected } = useCredit();

  const current = ALL_NAV_ITEMS.find(
    (item) =>
      location.pathname === item.to || location.pathname.startsWith(`${item.to}/`),
  );

  return (
    <header className="sticky top-0 z-30 border-b border-hairline cd-glass">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={onOpenNav}
          aria-label="Open navigation"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-hairline bg-surface text-ink-muted transition-colors hover:text-ink lg:hidden"
        >
          <Menu size={18} />
        </button>

        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-base font-semibold tracking-tight">
            {current?.label ?? 'Credora'}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {isConnected ? (
            <>
              <Badge
                tone={isRealTimeConnected ? 'positive' : 'neutral'}
                dot
                pulse={isRealTimeConnected}
                className="hidden sm:inline-flex"
              >
                {isRealTimeConnected ? 'Live' : 'Idle'}
              </Badge>

              <button
                type="button"
                onClick={() => void refresh()}
                disabled={isRefreshingScore || isRunningAi}
                aria-label="Refresh credit data"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-hairline bg-surface text-ink-muted transition-colors hover:text-ink disabled:opacity-50"
              >
                <RefreshCw className={cn('h-4 w-4', isRefreshingScore && 'animate-spin')} />
              </button>
            </>
          ) : null}

          <ThemeToggle />
          <ConnectWallet />
        </div>
      </div>
    </header>
  );
}
