import { Link } from 'react-router-dom';
import { ArrowRight, CalendarClock } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/Progress';
import { formatDate, formatEthCompact } from '@/lib/format';
import { statusLabel, type LoanView } from '@/lib/loans';
import type { Tone } from '@/lib/credit';

export function loanTone(loan: LoanView): Tone {
  if (loan.status === 'repaid') return 'positive';
  if (loan.status === 'defaulted') return 'critical';
  return loan.overdue ? 'critical' : 'brand';
}

export function LoanStatusBadge({ loan }: { loan: LoanView }) {
  return (
    <Badge tone={loanTone(loan)} dot pulse={loan.status === 'active' && !loan.overdue}>
      {statusLabel(loan.status, loan.overdue)}
    </Badge>
  );
}

export function LoanCard({ loan }: { loan: LoanView }) {
  const tone = loanTone(loan);

  return (
    <Card interactive className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-2xs font-semibold uppercase tracking-wider text-ink-faint">
            Principal
          </p>
          <p className="mt-1.5 font-display text-3xl font-semibold tabular tracking-tight">
            {formatEthCompact(loan.amount)}
            <span className="ml-1.5 text-sm font-semibold text-ink-soft">0G</span>
          </p>
        </div>
        <LoanStatusBadge loan={loan} />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4">
        <div>
          <p className="text-2xs uppercase tracking-wider text-ink-faint">Total repayment</p>
          <p className="mt-1 text-sm font-semibold tabular">
            {formatEthCompact(loan.totalRepayment)} 0G
          </p>
        </div>
        <div>
          <p className="text-2xs uppercase tracking-wider text-ink-faint">Rate</p>
          <p className="mt-1 text-sm font-semibold tabular">
            {(loan.interestRate * 100).toFixed(0)}% fixed
          </p>
        </div>
      </div>

      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="text-ink-muted">
            {loan.status === 'active' ? 'Term elapsed' : 'Term complete'}
          </span>
          <span className="font-semibold tabular text-ink">
            {Math.round(loan.progress * 100)}%
          </span>
        </div>
        <ProgressBar value={loan.progress} tone={tone} label="Loan term progress" />
      </div>

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-hairline-soft pt-4">
        <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
          <CalendarClock className="h-3.5 w-3.5" />
          {loan.status === 'active'
            ? loan.overdue
              ? `Overdue since ${formatDate(loan.dueDate)}`
              : `Due ${formatDate(loan.dueDate)} · ${loan.daysRemaining}d left`
            : `Closed ${formatDate(loan.repaidAt ?? loan.dueDate)}`}
        </span>

        <Link
          to={`/loans/${loan.loanId}`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 transition-colors hover:text-brand-900"
        >
          Details
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </Card>
  );
}
