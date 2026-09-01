import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  BadgeDollarSign,
  Check,
  CircleDot,
  Clock3,
  FileText,
  Receipt,
  AlertTriangle,
  Wallet,
} from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { StatRow } from '@/components/ui/MetricCard';
import { Badge, VerifiedBadge } from '@/components/ui/Badge';
import { Button, buttonStyles } from '@/components/ui/Button';
import { EmptyState, InlineNotice } from '@/components/ui/Feedback';
import { PageHeader } from '@/components/ui/PageHeader';
import { ProgressBar } from '@/components/ui/Progress';
import { Modal } from '@/components/ui/Modal';
import { LoanStatusBadge, loanTone } from '@/components/loans/LoanCard';
import { ConnectGate } from '@/components/wallet/ConnectGate';
import { useLoans } from '@/contexts/LoansContext';
import { useWallet } from '@/hooks/useWallet';
import { formatDate, formatDateTime, formatEth, formatEthCompact } from '@/lib/format';
import { LOAN_TERMS, loanTimeline, type MilestoneState } from '@/lib/loans';
import { LoanTxError, explorerTxUrl, phaseLabel, type LoanTxPhase } from '@/lib/loanTx';
import { cn } from '@/lib/utils';
import type { Hash } from 'viem';

const MILESTONE_STYLES: Record<MilestoneState, { dot: string; icon: typeof Check | null }> = {
  complete: { dot: 'bg-positive-500 text-white', icon: Check },
  current: { dot: 'bg-brand-500 text-white', icon: CircleDot },
  upcoming: { dot: 'bg-surface-inset text-ink-faint ring-1 ring-inset ring-hairline', icon: null },
  missed: { dot: 'bg-critical-500 text-white', icon: AlertTriangle },
};

export default function LoanDetails() {
  const { loanId } = useParams<{ loanId: string }>();
  const navigate = useNavigate();
  const { getLoan, repayLoan } = useLoans();
  const { balance, balanceSymbol } = useWallet();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [repaying, setRepaying] = useState(false);
  const [phase, setPhase] = useState<LoanTxPhase>('idle');
  const [txHash, setTxHash] = useState<Hash | null>(null);
  const [repayError, setRepayError] = useState<string | null>(null);

  const loan = loanId ? getLoan(loanId) : undefined;

  if (!loan) {
    return (
      <ConnectGate
        title="Loan details"
        description="Connect a wallet to view the full record for this loan."
      >
        <Card>
          <EmptyState
            icon={<BadgeDollarSign className="h-5 w-5" />}
            title="Loan not found"
            description="This loan is not associated with the connected wallet."
            action={
              <Link to="/loans" className={buttonStyles('primary', 'md')}>
                Back to loans
              </Link>
            }
          />
        </Card>
      </ConnectGate>
    );
  }

  const timeline = loanTimeline(loan);
  const walletBalance = balance ? parseFloat(balance) : 0;
  const canCover = walletBalance >= loan.totalRepayment;

  const handleRepay = async () => {
    setRepaying(true);
    setRepayError(null);
    try {
      await repayLoan(loan.loanId, (next, hash) => {
        setPhase(next);
        if (hash) setTxHash(hash);
      });
      toast.success('Repayment confirmed on-chain');
      setConfirmOpen(false);
    } catch (error) {
      const txError = error instanceof LoanTxError ? error : null;
      if (txError?.txHash) setTxHash(txError.txHash);
      setPhase('failed');
      const message = error instanceof Error ? error.message : 'Repayment could not be completed';
      setRepayError(message);
      toast.error(message);
    } finally {
      setRepaying(false);
    }
  };

  return (
    <ConnectGate
      title="Loan details"
      description="Connect a wallet to view the full record for this loan."
    >
      <div className="space-y-8">
        <div>
          <button
            type="button"
            onClick={() => navigate('/loans')}
            className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" />
            All loans
          </button>

          <PageHeader
            eyebrow={
              <>
                <LoanStatusBadge loan={loan} />
                {loan.verification?.status === 'verified' ? (
                  <VerifiedBadge label="0G Verified" />
                ) : null}
              </>
            }
            title={`${formatEthCompact(loan.amount)} 0G loan`}
            description={`Originated ${formatDate(loan.createdAt)} · accounting principal on Loan.sol`}
            actions={
              loan.status === 'active' && !loan.overdue ? (
                <Button onClick={() => setConfirmOpen(true)} iconLeft={<Receipt className="h-4 w-4" />}>
                  Repay {formatEthCompact(loan.totalRepayment)} 0G
                </Button>
              ) : null
            }
          />
        </div>

        {loan.overdue ? (
          <InlineNotice
            tone="critical"
            title="This loan is past its due date"
            icon={<AlertTriangle className="h-4 w-4" />}
          >
            Repayment was due {formatDate(loan.dueDate)}. Loan.sol rejects repayLoan after dueTime,
            so this overdue loan cannot be settled on the current contract. That is a contract
            limitation, not a UI error.
          </InlineNotice>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-[1fr_minmax(0,360px)]">
          <div className="space-y-4">
            {/* Repayment progress */}
            <Card>
              <CardHeader
                title="Repayment progress"
                description={
                  loan.status === 'active'
                    ? `Single payment due at the end of the ${LOAN_TERMS.durationDays}-day term.`
                    : 'This loan has been settled.'
                }
              />
              <CardBody className="pt-4">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="text-2xs uppercase tracking-wider text-ink-faint">
                      Amount due
                    </p>
                    <p className="mt-1.5 font-display text-4xl font-semibold tabular tracking-tight">
                      {formatEthCompact(loan.status === 'repaid' ? 0 : loan.totalRepayment)}
                      <span className="ml-2 text-base font-semibold text-ink-soft">0G</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xs uppercase tracking-wider text-ink-faint">
                      {loan.status === 'active' ? 'Time remaining' : 'Term'}
                    </p>
                    <p className="mt-1.5 font-display text-2xl font-semibold tabular tracking-tight">
                      {loan.status === 'active'
                        ? `${Math.max(loan.daysRemaining, 0)}d`
                        : `${LOAN_TERMS.durationDays}d`}
                    </p>
                  </div>
                </div>

                <div className="mt-6">
                  <div className="mb-2 flex items-center justify-between text-xs text-ink-muted">
                    <span>{formatDate(loan.createdAt)}</span>
                    <span>{formatDate(loan.dueDate)}</span>
                  </div>
                  <ProgressBar value={loan.progress} tone={loanTone(loan)} size="lg" />
                </div>
              </CardBody>
            </Card>

            {/* Schedule */}
            <Card>
              <CardHeader
                title="Repayment schedule"
                description="Milestones for this loan, derived from its contract terms."
                icon={<Clock3 className="h-4 w-4" />}
              />
              <CardBody className="pt-4">
                <ol className="relative space-y-6">
                  {timeline.map((milestone, index) => {
                    const style = MILESTONE_STYLES[milestone.state];
                    const Icon = style.icon;

                    return (
                      <li key={milestone.id} className="relative flex gap-4">
                        {index < timeline.length - 1 ? (
                          <span
                            className="absolute left-[15px] top-9 h-full w-px bg-hairline"
                            aria-hidden
                          />
                        ) : null}

                        <span
                          className={cn(
                            'relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ring-4 ring-surface',
                            style.dot,
                          )}
                        >
                          {Icon ? <Icon className="h-3.5 w-3.5" /> : index + 1}
                        </span>

                        <div className="min-w-0 flex-1 pb-1">
                          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                            <p className="text-sm font-semibold">{milestone.label}</p>
                            <span className="text-xs text-ink-soft">
                              {formatDate(milestone.date)}
                            </span>
                          </div>
                          <p className="mt-0.5 text-sm text-ink-muted">{milestone.detail}</p>
                          {milestone.amount !== null ? (
                            <span className="mt-2 inline-block rounded-md bg-surface-inset px-2 py-0.5 text-xs font-semibold tabular">
                              {formatEthCompact(milestone.amount)} 0G
                            </span>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </CardBody>
            </Card>

            {/* Record trail */}
            <Card>
              <CardHeader
                title="Record history"
                description="Events indexed from Loan.sol and, when stored, retrieved from 0G Storage."
                icon={<FileText className="h-4 w-4" />}
                action={
                  loan.verification?.status === 'verified' ? (
                    <VerifiedBadge label="Verified record" />
                  ) : null
                }
              />
              <div className="px-6 pb-6 pt-2">
                <StatRow label="Loan identifier" value={loan.loanId} mono />
                {loan.originTxHash ? (
                  <StatRow
                    label="Origination tx"
                    value={
                      <a
                        href={explorerTxUrl(loan.originTxHash)}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-brand-700 hover:underline"
                      >
                        {loan.originTxHash.slice(0, 10)}…{loan.originTxHash.slice(-6)}
                      </a>
                    }
                  />
                ) : null}
                {loan.repaidTxHash ? (
                  <StatRow
                    label="Repayment tx"
                    value={
                      <a
                        href={explorerTxUrl(loan.repaidTxHash)}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-brand-700 hover:underline"
                      >
                        {loan.repaidTxHash.slice(0, 10)}…{loan.repaidTxHash.slice(-6)}
                      </a>
                    }
                  />
                ) : null}
                <StatRow label="Originated" value={formatDateTime(loan.createdAt)} />
                <StatRow label="Due" value={formatDateTime(loan.dueDate)} />
                {loan.repaidAt ? (
                  <StatRow
                    label="Repaid"
                    value={formatDateTime(loan.repaidAt)}
                    tone="positive"
                  />
                ) : null}
                <StatRow label="Status" value={loan.status} />
              </div>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <Card surface="brand" className="p-6">
              <p className="text-2xs font-semibold uppercase tracking-wider text-brand-200">
                Loan summary
              </p>
              <div className="mt-4 space-y-3">
                {[
                  { label: 'Recorded principal', value: `${formatEthCompact(loan.amount)} 0G` },
                  {
                    label: `Interest (${(loan.interestRate * 100).toFixed(0)}%)`,
                    value: `${formatEthCompact(loan.interest)} 0G`,
                  },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-4">
                    <span className="text-sm text-brand-100">{row.label}</span>
                    <span className="text-sm font-semibold tabular text-white">{row.value}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-4 border-t border-white/10 pt-3">
                  <span className="text-sm font-medium text-brand-100">Total repayment</span>
                  <span className="font-display text-xl font-semibold tabular text-white">
                    {formatEthCompact(loan.totalRepayment)} 0G
                  </span>
                </div>
              </div>

              {loan.status === 'active' && !loan.overdue ? (
                <Button
                  variant="inverse"
                  fullWidth
                  className="mt-6"
                  onClick={() => setConfirmOpen(true)}
                  iconLeft={<Receipt className="h-4 w-4" />}
                >
                  Repay loan
                </Button>
              ) : loan.status === 'active' && loan.overdue ? (
                <Badge tone="critical" className="mt-6 w-full justify-center py-2">
                  Past due — contract will reject repay
                </Badge>
              ) : (
                <Badge tone="positive" className="mt-6 w-full justify-center py-2">
                  Settled in full
                </Badge>
              )}
            </Card>

            <Card>
              <CardHeader title="Your wallet" icon={<Wallet className="h-4 w-4" />} compact />
              <div className="px-5 pb-5 pt-2">
                <StatRow
                  label="Available balance"
                  value={balance ? `${formatEth(balance)} ${balanceSymbol}` : '—'}
                />
                <StatRow
                  label="Covers repayment"
                  value={canCover ? 'Yes' : 'Insufficient'}
                  tone={canCover ? 'positive' : 'critical'}
                />
              </div>
            </Card>

            <Card surface="muted">
              <CardHeader title="Terms" compact />
              <div className="px-5 pb-5 pt-2">
                <StatRow label="Rate" value={`${LOAN_TERMS.interestRate * 100}% fixed`} />
                <StatRow label="Duration" value={`${LOAN_TERMS.durationDays} days`} />
                <StatRow label="Processing fee" value="0%" />
                <StatRow label="Early repayment" value="No penalty" tone="positive" />
              </div>
            </Card>
          </div>
        </section>
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Confirm repayment"
        description="This sends principal plus 5% interest to Loan.sol and closes the on-chain loan. The original accounting principal was never sent to your wallet."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)} disabled={repaying}>
              Cancel
            </Button>
            <Button onClick={() => void handleRepay()} loading={repaying} disabled={loan.overdue}>
              {repaying ? phaseLabel(phase === 'idle' ? 'wallet' : phase) : `Repay ${formatEthCompact(loan.totalRepayment)} 0G`}
            </Button>
          </>
        }
      >
        <div className="space-y-1">
          <StatRow label="Recorded principal" value={`${formatEthCompact(loan.amount)} 0G`} />
          <StatRow
            label={`Interest (${(loan.interestRate * 100).toFixed(0)}%)`}
            value={`${formatEthCompact(loan.interest)} 0G`}
          />
          <StatRow
            label="Total"
            value={`${formatEthCompact(loan.totalRepayment)} 0G`}
            tone="brand"
          />
        </div>

        {txHash ? (
          <a
            href={explorerTxUrl(txHash)}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-block text-xs font-medium text-brand-700 hover:underline"
          >
            View transaction {txHash.slice(0, 10)}…
          </a>
        ) : null}

        {repayError ? (
          <InlineNotice tone="critical" className="mt-4" icon={<AlertTriangle className="h-4 w-4" />}>
            {repayError}
          </InlineNotice>
        ) : null}

        {!canCover ? (
          <InlineNotice
            tone="caution"
            className="mt-4"
            icon={<AlertTriangle className="h-4 w-4" />}
          >
            Your wallet balance is below the repayment amount. Top up before settling.
          </InlineNotice>
        ) : null}
      </Modal>
    </ConnectGate>
  );
}
