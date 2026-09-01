import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { truncateAddress } from '@/lib/format';
import { useCopy } from '@/hooks/useCopy';

/** RainbowKit's connect flow, restyled to match the Credora system. */
export function ConnectWallet({
  size = 'md',
  fullWidth,
}: {
  size?: 'sm' | 'md';
  fullWidth?: boolean;
}) {
  return (
    <div className={cn('cd-connect', fullWidth && 'w-full [&>div]:w-full')}>
      <ConnectButton
        showBalance={false}
        accountStatus={{ smallScreen: 'avatar', largeScreen: 'address' }}
        chainStatus={{ smallScreen: 'icon', largeScreen: 'icon' }}
        label={size === 'sm' ? 'Connect' : 'Connect wallet'}
      />
    </div>
  );
}

export function AddressChip({
  address,
  className,
  showCopy = true,
}: {
  address: string;
  className?: string;
  showCopy?: boolean;
}) {
  const { copied, copy } = useCopy();

  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-lg border border-hairline bg-surface-muted px-2.5 py-1.5',
        className,
      )}
    >
      <span className="font-mono text-xs text-ink-muted">{truncateAddress(address)}</span>
      {showCopy ? (
        <button
          type="button"
          onClick={() => void copy(address)}
          aria-label="Copy wallet address"
          className="text-ink-soft transition-colors hover:text-brand-600"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-positive-500" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </button>
      ) : null}
    </span>
  );
}
