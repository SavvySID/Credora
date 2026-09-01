import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, BadgeDollarSign, LayoutGrid, List, Plus } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { MetricCard } from '@/components/ui/MetricCard';
import { Button, buttonStyles } from '@/components/ui/Button';
import { EmptyState, Skeleton } from '@/components/ui/Feedback';
import { PageHeader } from '@/components/ui/PageHeader';
import { SegmentedControl } from '@/components/ui/Field';
import { ProgressBar } from '@/components/ui/Progress';
import { DataTable, type Column } from '@/components/ui/Table';
import { LoanCard, LoanStatusBadge, loanTone } from '@/components/loans/LoanCard';
import { ConnectGate } from '@/components/wallet/ConnectGate';
import { useLoans } from '@/contexts/LoansContext';
import { formatDate, formatEthCompact } from '@/lib/format';
import type { LoanView } from '@/lib/loans';

type StatusFilter = 'all' | 'active' | 'repaid' | 'defaulted';
type ViewMode = 'table' | 'grid';

export default function Loans() {
  const navigate = useNavigate();
  const { loans, activeLoans, isLoading } = useLoans();

  const [status, setStatus] = useState<StatusFilter>('all');
  const [view, setView] = useState<ViewMode>('table');

  const filtered = useMemo(
    () => (status === 'all' ? loans : loans.filter((loan) => loan.status === status)),
    [loans, status],
  );

  const totals = useMemo(() => {
    const borrowed = loans.reduce((sum, loan) => sum + loan.amount, 0);
    const outstanding = activeLoans.reduce((sum, loan) => sum + loan.totalRepayment, 0);
    const interest = loans.reduce((sum, loan) => sum + loan.interest, 0);
    const repaid = loans.filter((loan) => loan.status === 'repaid').length;
    return { borrowed, outstanding, interest, repaid };
  }, [loans, activeLoans]);

  const columns: Column<LoanView>[] = [
    {
      key: 'loan',
      header: 'Loan',
      render: (loan) => (
        <div className="min-w-0">
          <p className="font-display text-base font-semibold tabular tracking-tight">
            {formatEthCompact(loan.amount)} 0G
          </p>
          <p className="mt-0.5 font-mono text-2xs text-ink-soft">{loan.loanId}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (loan) => <LoanStatusBadge loan={loan} />,
    },
    {
      key: 'progress',
      header: 'Term progress',
      hideBelow: 'lg',
      width: '180px',
      render: (loan) => (
        <div className="w-40">
          <ProgressBar value={loan.progress} tone={loanTone(loan)} size="sm" />
          <p className="mt-1.5 text-2xs text-ink-soft">
            {Math.round(loan.progress * 100)}% elapsed
          </p>
        </div>
      ),
    },
    {
      key: 'rate',
      header: 'Rate',
      numeric: true,
      hideBelow: 'md',
      render: (loan) => (
        <span className="text-sm font-medium">{(loan.interestRate * 100).toFixed(0)}%</span>
      ),
    },
    {
      key: 'due',
      header: 'Due',
      hideBelow: 'sm',
      render: (loan) => (
        <div>
          <p className="text-sm font-medium">{formatDate(loan.dueDate)}</p>
          {loan.status === 'active' ? (
            <p className={`mt-0.5 text-2xs ${loan.overdue ? 'text-critical-600' : 'text-ink-soft'}`}>
              {loan.overdue ? 'Overdue' : `${loan.daysRemaining} days left`}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'total',
      header: 'Repayment',
      numeric: true,
      render: (loan) => (
        <span className="font-semibold">{formatEthCompact(loan.totalRepayment)} 0G</span>
      ),
    },
    {
      key: 'action',
      header: '',
      numeric: true,
      width: '56px',
      render: () => <ArrowRight className="ml-auto h-4 w-4 text-ink-faint" />,
    },
  ];

  return (
    <ConnectGate
      title="Your loans"
      description="Connect a wallet to review your borrowing history, repayment progress and outstanding obligations."
    >
      <div className="space-y-8">
        <PageHeader
          title="Loans"
          description="Every loan originated against your Credora assessment, with live repayment status."
          actions={
            <Link to="/borrow" className={buttonStyles('primary', 'md')}>
              <Plus className="h-4 w-4" />
              Request a loan
            </Link>
          }
        />

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Total borrowed"
            value={formatEthCompact(totals.borrowed)}
            unit="0G"
            caption={`${loans.length} ${loans.length === 1 ? 'loan' : 'loans'} originated`}
          />
          <MetricCard
            label="Outstanding"
            value={formatEthCompact(totals.outstanding)}
            unit="0G"
            caption={`${activeLoans.length} active`}
            accent
          />
          <MetricCard
            label="Interest committed"
            value={formatEthCompact(totals.interest)}
            unit="0G"
            caption="Across all loans"
          />
          <MetricCard
            label="Loans repaid"
            value={totals.repaid}
            caption={loans.length > 0 ? `of ${loans.length} total` : 'No history yet'}
          />
        </section>

        <Card>
          <CardHeader
            title="Loan portfolio"
            description="Filter by status, or switch to cards for a fuller view."
            action={
              <div className="hidden items-center gap-2 sm:flex">
                <SegmentedControl<ViewMode>
                  size="sm"
                  value={view}
                  onChange={setView}
                  options={[
                    { value: 'table', label: 'Table' },
                    { value: 'grid', label: 'Cards' },
                  ]}
                />
              </div>
            }
          />

          <div className="flex flex-wrap items-center gap-3 px-6 pb-2 pt-4">
            <SegmentedControl<StatusFilter>
              value={status}
              onChange={setStatus}
              options={[
                { value: 'all', label: `All (${loans.length})` },
                { value: 'active', label: `Active (${activeLoans.length})` },
                { value: 'repaid', label: 'Repaid' },
                { value: 'defaulted', label: 'Defaulted' },
              ]}
            />
            <div className="ml-auto flex gap-1 sm:hidden">
              <Button
                variant={view === 'table' ? 'subtle' : 'ghost'}
                size="sm"
                onClick={() => setView('table')}
                aria-label="Table view"
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant={view === 'grid' ? 'subtle' : 'ghost'}
                size="sm"
                onClick={() => setView('grid')}
                aria-label="Card view"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {isLoading ? (
            <CardBody className="space-y-3 pt-4">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </CardBody>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<BadgeDollarSign className="h-5 w-5" />}
              title={status === 'all' ? 'No loans yet' : `No ${status} loans`}
              description={
                status === 'all'
                  ? 'Request your first loan to start building repayment history, which strengthens future assessments.'
                  : 'Try a different filter to see the rest of your portfolio.'
              }
              action={
                status === 'all' ? (
                  <Link to="/borrow" className={buttonStyles('primary', 'md')}>
                    Request a loan
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                ) : (
                  <Button variant="secondary" size="sm" onClick={() => setStatus('all')}>
                    Clear filter
                  </Button>
                )
              }
            />
          ) : view === 'table' ? (
            <div className="pt-2">
              <DataTable
                columns={columns}
                rows={filtered}
                getRowKey={(loan) => loan.loanId}
                onRowClick={(loan) => navigate(`/loans/${loan.loanId}`)}
              />
            </div>
          ) : (
            <CardBody className="grid gap-4 pt-4 md:grid-cols-2">
              {filtered.map((loan) => (
                <LoanCard key={loan.loanId} loan={loan} />
              ))}
            </CardBody>
          )}
        </Card>
      </div>
    </ConnectGate>
  );
}
