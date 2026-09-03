import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { buttonStyles } from '@/components/ui/Button';
import { ConnectGate } from '@/components/wallet/ConnectGate';
import { BorrowerLookup } from '@/components/lender/BorrowerLookup';
import { BorrowerRiskPanel } from '@/components/lender/BorrowerRiskPanel';
import { api, type CreditProfileDto } from '@/services/api';

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

export default function LenderBorrower() {
  const { address } = useParams();
  const wallet = address?.toLowerCase() ?? '';
  const [profile, setProfile] = useState<CreditProfileDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ADDRESS.test(wallet)) {
      setError('Invalid address');
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api
      .lenderBorrower(wallet)
      .then((next) => {
        if (!cancelled) setProfile(next);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Lookup failed');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [wallet]);

  return (
    <ConnectGate title="Borrower intelligence" description="Connect to review indexed Credora risk data.">
      <div className="space-y-8">
        <PageHeader
          title="Borrower intelligence"
          description="Deterministic score, 0G Compute assessment when available, and 0G verification. Not a funding action."
          actions={
            <Link to="/lender" className={buttonStyles('ghost')}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Link>
          }
        />
        <BorrowerLookup initial={wallet} />
        {loading ? (
          <Skeleton className="h-64 w-full" />
        ) : error ? (
          <ErrorState description={error} />
        ) : !profile ? (
          <EmptyState
            title="No intelligence for this wallet"
            description="No fabricated borrower was created. Connect or index activity to populate this view."
          />
        ) : (
          <BorrowerRiskPanel profile={profile} />
        )}
      </div>
    </ConnectGate>
  );
}
