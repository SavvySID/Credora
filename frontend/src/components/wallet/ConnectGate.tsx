import type { ReactNode } from 'react';
import { ArrowRight, ShieldCheck, Wallet } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { ConnectWallet } from './WalletChip';
import { useWallet } from '@/hooks/useWallet';

const ASSURANCES = [
  'Read-only access — Credora never takes custody of your funds',
  'Your assessment is derived from public on-chain activity',
  'Records are attested through the 0G network',
];

/**
 * Wallet connection is the app's only authentication step, so every gated route
 * shares this single entry point instead of repeating a bespoke empty state.
 */
export function ConnectGate({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  const { isConnected } = useWallet();

  if (isConnected) return <>{children}</>;

  return (
    <div className="mx-auto max-w-4xl py-6 sm:py-12">
      <Card surface="brand" elevation="floating" className="overflow-hidden">
        <div className="relative">
          <div className="absolute inset-0 cd-grid-texture opacity-60" aria-hidden />
          <div className="relative px-6 py-10 sm:px-12 sm:py-14">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-brand-200">
              <Wallet className="h-5 w-5" />
            </span>

            <h1 className="mt-6 font-display text-display-sm font-semibold text-white sm:text-display-md">
              {title}
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-brand-100 sm:text-base">
              {description}
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <ConnectWallet />
              <a
                href="https://metamask.io"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-200 transition-colors hover:text-white"
              >
                Get a wallet
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 bg-white/5 px-6 py-6 sm:px-12">
          <ul className="grid gap-3 sm:grid-cols-3">
            {ASSURANCES.map((item) => (
              <li key={item} className="flex gap-2.5 text-xs leading-relaxed text-brand-100">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-300" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </Card>
    </div>
  );
}
