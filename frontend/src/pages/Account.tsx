import { Link } from 'react-router-dom';
import {
  Check,
  Copy,
  Database,
  ExternalLink,
  Gauge,
  LogOut,
  Cpu,
  Palette,
  Radio,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { StatRow } from '@/components/ui/MetricCard';
import { Badge, VerifiedBadge } from '@/components/ui/Badge';
import { Button, buttonStyles } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { InlineNotice } from '@/components/ui/Feedback';
import { ThemeSelect } from '@/components/ui/ThemeToggle';
import { ConnectGate } from '@/components/wallet/ConnectGate';
import { useWallet } from '@/hooks/useWallet';
import { useCredit } from '@/contexts/CreditContext';
import { useLoans } from '@/contexts/LoansContext';
import { useCopy } from '@/hooks/useCopy';
import { formatDateTime, formatEth, formatNumber, truncateAddress } from '@/lib/format';
import { ratingLabel, toneForLevel } from '@/lib/credit';

const SERVICES = [
  {
    key: 'storage',
    icon: Database,
    name: '0G Storage',
    description: 'Wallet profiles, transactions and lending records',
  },
  {
    key: 'compute',
    icon: Cpu,
    name: '0G Compute',
    description: 'Structured borrower-risk JSON when an inference key is configured',
  },
  {
    key: 'pipeline',
    icon: Radio,
    name: 'Event stream',
    description: 'Indexed Loan.sol and wallet events',
  },
] as const;

export default function Account() {
  const {
    account,
    balance,
    balanceSymbol,
    transactionCount,
    chainName,
    chainId,
    disconnectWallet,
  } = useWallet();
  const { profile, history, zeroGStatus, isRealTimeConnected } = useCredit();
  const { loans, activeLoans } = useLoans();
  const { copied, copy } = useCopy();

  const online = (key: string) =>
    key === 'pipeline'
      ? zeroGStatus.pipelineConnected
      : key === 'compute'
        ? zeroGStatus.computeConfigured && zeroGStatus.computeOnline
        : zeroGStatus.storageOnline || zeroGStatus.initialized;

  return (
    <ConnectGate
      title="Your account"
      description="Connect a wallet to review your profile, network details and the infrastructure behind your assessments."
    >
      <div className="space-y-8">
        <PageHeader
          title="Account"
          description="Wallet identity, credit standing and the services powering your Credora records."
          actions={
            <Button
              variant="secondary"
              onClick={disconnectWallet}
              iconLeft={<LogOut className="h-4 w-4" />}
            >
              Disconnect
            </Button>
          }
        />

        {/* Identity */}
        <Card surface="brand" elevation="floating" className="relative overflow-hidden">
          <div className="absolute inset-0 cd-grid-texture opacity-40" aria-hidden />
          <div className="relative flex flex-col gap-6 px-6 py-8 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-brand-200">
                <Wallet className="h-6 w-6" />
              </span>
              <div className="min-w-0">
                <p className="text-2xs font-semibold uppercase tracking-wider text-brand-200">
                  Connected wallet
                </p>
                <p className="mt-1 font-mono text-lg font-medium text-white">
                  {truncateAddress(account, 10, 8)}
                </p>
                <button
                  type="button"
                  onClick={() => account && void copy(account)}
                  className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-brand-200 transition-colors hover:text-white"
                >
                  {copied ? (
                    <>
                      <Check className="h-3 w-3" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" /> Copy full address
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
              {[
                {
                  label: 'Balance',
                  value: balance ? `${formatEth(balance, 3)}` : '—',
                  suffix: balanceSymbol,
                },
                { label: 'Transactions', value: formatNumber(transactionCount), suffix: '' },
                {
                  label: 'Score',
                  value: profile ? String(profile.creditScore) : '—',
                  suffix: profile ? '/1000' : '',
                },
              ].map((stat) => (
                <div key={stat.label}>
                  <p className="text-2xs uppercase tracking-wider text-brand-200">{stat.label}</p>
                  <p className="mt-1 font-display text-xl font-semibold tabular text-white">
                    {stat.value}
                    {stat.suffix ? (
                      <span className="ml-1 text-xs font-medium text-brand-200">{stat.suffix}</span>
                    ) : null}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Profile */}
          <Card>
            <CardHeader
              title="Profile"
              description="Your standing across the protocol."
              icon={<Gauge className="h-4 w-4" />}
              action={
                profile ? (
                  <Badge tone={toneForLevel(profile.riskLevel)} dot>
                    {ratingLabel(profile.riskLevel)}
                  </Badge>
                ) : null
              }
            />
            <div className="px-6 pb-6 pt-2">
              <StatRow
                label="Credit score"
                value={profile ? `${profile.creditScore} / 1000` : '—'}
              />
              <StatRow label="Rating band" value={profile ? ratingLabel(profile.riskLevel) : '—'} />
              <StatRow label="Assessments recorded" value={formatNumber(history.length)} />
              <StatRow label="Loans originated" value={formatNumber(loans.length)} />
              <StatRow label="Active loans" value={formatNumber(activeLoans.length)} />
              <StatRow
                label="Last assessed"
                value={profile ? formatDateTime(profile.timestamp) : '—'}
              />
            </div>
            <CardBody className="pt-0">
              <Link to="/credit-score" className={buttonStyles('secondary', 'sm', 'w-full')}>
                View full assessment
              </Link>
            </CardBody>
          </Card>

          {/* Network */}
          <Card>
            <CardHeader
              title="Network"
              description="Where your wallet is currently connected."
              icon={<ShieldCheck className="h-4 w-4" />}
            />
            <div className="px-6 pb-6 pt-2">
              <StatRow label="Chain" value={chainName ?? '—'} />
              <StatRow label="Chain ID" value={chainId ?? '—'} />
              <StatRow label="Native asset" value={balanceSymbol} />
              <StatRow
                label="Live updates"
                value={isRealTimeConnected ? 'Streaming' : 'Idle'}
                tone={isRealTimeConnected ? 'positive' : 'default'}
              />
            </div>
            <CardBody className="pt-0">
              <InlineNotice tone="info">
                Credora reads public chain data only. It never requests transfer approvals or takes
                custody of your assets.
              </InlineNotice>
            </CardBody>
          </Card>
        </div>

        {/* Appearance */}
        <Card>
          <CardHeader
            title="Appearance"
            description="Choose a theme, or follow your operating system."
            icon={<Palette className="h-4 w-4" />}
          />
          <CardBody className="pt-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="max-w-md text-sm leading-relaxed text-ink-muted">
                Your preference is stored on this device and applies across every Credora screen.
              </p>
              <ThemeSelect />
            </div>
          </CardBody>
        </Card>

        {/* Infrastructure */}
        <Card>
          <CardHeader
            title="0G infrastructure"
            description="The services generating and attesting your records."
            action={
              <Badge tone={zeroGStatus.initialized ? 'positive' : 'neutral'} dot pulse={zeroGStatus.initialized}>
                {zeroGStatus.initialized ? 'Operational' : 'Unavailable'}
              </Badge>
            }
          />
          <CardBody className="pt-4">
            <div className="grid gap-4 sm:grid-cols-3">
              {SERVICES.map((service) => (
                <div
                  key={service.key}
                  className="rounded-xl border border-hairline bg-surface-muted p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface text-brand-700 shadow-hairline">
                      <service.icon className="h-4 w-4" />
                    </span>
                    <Badge
                      tone={
                        service.key === 'compute' && !zeroGStatus.computeConfigured
                          ? 'neutral'
                          : online(service.key)
                            ? 'positive'
                            : 'neutral'
                      }
                      dot
                      size="sm"
                    >
                      {service.key === 'compute' && !zeroGStatus.computeConfigured
                        ? 'Unavailable'
                        : online(service.key)
                          ? 'Online'
                          : 'Offline'}
                    </Badge>
                  </div>
                  <h4 className="mt-4 text-sm font-semibold">{service.name}</h4>
                  <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                    {service.description}
                  </p>
                </div>
              ))}
            </div>

            {!zeroGStatus.computeConfigured ? (
              <InlineNotice tone="info" className="mt-4" title="0G Compute is not configured">
                Set ZG_COMPUTE_API_KEY and ZG_COMPUTE_MODEL on the API server. Until then, Credora
                uses the deterministic score only. Nothing here is labelled AI-generated.
              </InlineNotice>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-hairline bg-surface-muted px-5 py-4">
              <div className="flex items-center gap-3">
                {zeroGStatus.verifiedRecords > 0 ? <VerifiedBadge /> : null}
                <span className="text-sm text-ink-muted">
                  {zeroGStatus.subscriberCount} active{' '}
                  {zeroGStatus.subscriberCount === 1 ? 'subscription' : 'subscriptions'}
                  {zeroGStatus.verifiedRecords > 0
                    ? ` · ${zeroGStatus.verifiedRecords} verified records`
                    : ''}
                </span>
              </div>
              <a
                href="https://0g.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 transition-colors hover:text-brand-900"
              >
                About 0G
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </CardBody>
        </Card>
      </div>
    </ConnectGate>
  );
}
