import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { DataTable } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { ConnectGate } from '@/components/wallet/ConnectGate';
import { BorrowerLookup } from '@/components/lender/BorrowerLookup';
import { api } from '@/services/api';
import { truncateAddress } from '@/lib/format';
import { VerificationStatusBadge } from '@/components/credit/VerificationStatusBadge';

export default function Lender() {
  const [rows, setRows] = useState<
    Awaited<ReturnType<typeof api.lenderBorrowers>>['borrowers']
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .lenderBorrowers(50)
      .then((payload) => {
        if (!cancelled) setRows(payload.borrowers);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load borrowers');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ConnectGate
      title="Lender desk"
      description="Look up a Galileo wallet to review Credora score, 0G Compute assessment, and verification. This is not a lending pool."
    >
      <div className="space-y-8">
        <PageHeader
          title="Lender desk"
          description="Risk intelligence for indexed Credora wallets. Credora does not provide capital."
        />

        <Card>
          <CardHeader title="Look up a borrower" icon={<Search className="h-4 w-4" />} />
          <CardBody>
            <BorrowerLookup />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Indexed borrowers"
            description="Wallets that already have Credora loans or assessments. Empty until those records exist."
          />
          <CardBody>
            {loading ? (
              <Skeleton className="h-32 w-full" />
            ) : error ? (
              <ErrorState description={error} />
            ) : rows.length === 0 ? (
              <EmptyState
                title="No indexed Credora borrowers yet"
                description="The roster only lists wallets with indexed loans or credit assessments."
              />
            ) : (
              <DataTable
                getRowKey={(row) => row.wallet}
                columns={[
                  {
                    key: 'wallet',
                    header: 'Wallet',
                    render: (row) => (
                      <Link to={`/lender/${row.wallet}`} className="font-mono text-sm text-brand-700">
                        {truncateAddress(row.wallet)}
                      </Link>
                    ),
                  },
                  {
                    key: 'score',
                    header: 'Score',
                    numeric: true,
                    render: (row) => row.lastDeterministicScore ?? '—',
                  },
                  {
                    key: 'ai',
                    header: 'Compute risk',
                    render: (row) =>
                      row.lastAiRiskLevel ? (
                        <Badge tone="brand" size="sm">
                          {row.lastAiRiskLevel} · {row.lastAiRiskScore}
                        </Badge>
                      ) : (
                        '—'
                      ),
                  },
                  {
                    key: 'loan',
                    header: 'Loan',
                    render: (row) =>
                      row.overdue ? 'Overdue' : row.hasActiveLoan ? 'Active' : 'None',
                  },
                  {
                    key: 'verify',
                    header: 'Verification',
                    render: (row) => <VerificationStatusBadge status={row.latestVerification} />,
                  },
                ]}
                rows={rows}
              />
            )}
          </CardBody>
        </Card>
      </div>
    </ConnectGate>
  );
}
