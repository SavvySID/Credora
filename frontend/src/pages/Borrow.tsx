import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowRight,
  Calculator,
  CheckCircle2,
  Gauge,
  Info,
  ShieldCheck,
  Wallet,
  XCircle,
} from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { StatRow } from '@/components/ui/MetricCard';
import { Badge } from '@/components/ui/Badge';
import { Button, buttonStyles } from '@/components/ui/Button';
import { InlineNotice } from '@/components/ui/Feedback';
import { PageHeader } from '@/components/ui/PageHeader';
import { ProgressBar } from '@/components/ui/Progress';
import { Field, Input } from '@/components/ui/Field';
import { ConnectGate } from '@/components/wallet/ConnectGate';
import { useWallet } from '@/hooks/useWallet';
import { useLoanEligibility } from '@/hooks/useLoanEligibility';
import { useCredit } from '@/contexts/CreditContext';
import { useLoans } from '@/contexts/LoansContext';
import { useActivity } from '@/contexts/ActivityContext';
import { formatDate, formatEth, formatEthCompact } from '@/lib/format';
import { LOAN_TERMS, capacityWarning, interestFor, totalRepaymentFor } from '@/lib/loans';
import { ratingLabel, toneForLevel } from '@/lib/credit';
import {
  LoanTxError,
  explorerTxUrl,
  originationDepositEth,
  phaseLabel,
  type LoanTxPhase,
} from '@/lib/loanTx';
import type { Hash } from 'viem';

type Outcome = 'idle' | 'approved' | 'declined';

const QUICK_FRACTIONS = [0.25, 0.5, 0.75, 1];

export default function Borrow() {
  const { balance, balanceSymbol } = useWallet();
  const eligibility = useLoanEligibility();
  const { profile } = useCredit();
  const { createLoan } = useLoans();
  const { record } = useActivity();

  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>('idle');
  const [reasons, setReasons] = useState<string[]>([]);
  const [approvedLoanId, setApprovedLoanId] = useState<string | null>(null);
  const [phase, setPhase] = useState<LoanTxPhase>('idle');
  const [txHash, setTxHash] = useState<Hash | null>(null);

  const walletBalance = balance ? parseFloat(balance) : 0;
  const guidelineMax = walletBalance * LOAN_TERMS.maxBalanceMultiple;
  const parsedAmount = parseFloat(amount);
  const hasAmount = !Number.isNaN(parsedAmount) && parsedAmount > 0;

  const interest = hasAmount ? interestFor(parsedAmount) : 0;
  const total = hasAmount ? totalRepaymentFor(parsedAmount) : 0;
  const utilisation = guidelineMax > 0 && hasAmount ? Math.min(parsedAmount / guidelineMax, 1) : 0;
  const guideline = hasAmount ? capacityWarning(parsedAmount, walletBalance) : null;

  const dueDate = useMemo(
    () => new Date(Date.now() + LOAN_TERMS.durationDays * 86_400_000),
    [],
  );

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!hasAmount) {
      toast.error('Enter a valid amount');
      return;
    }

    setSubmitting(true);
    setPhase('idle');
    setTxHash(null);

    try {
      const loan = await createLoan(parsedAmount, (next, hash) => {
        setPhase(next);
        if (hash) setTxHash(hash);
      });
      setApprovedLoanId(loan.loanId);
      setOutcome('approved');
      record({
        type: 'loan_approved',
        title: 'Loan recorded on-chain',
        description: loan.originTxHash
          ? `Accounting principal ${parsedAmount} 0G. Tx ${loan.originTxHash.slice(0, 10)}…`
          : `Accounting principal ${parsedAmount} 0G recorded on Loan.sol`,
        amount: parsedAmount,
        tone: 'positive',
        verified: loan.verification?.status === 'verified',
      });
      toast.success('Loan recorded on-chain');
    } catch (error) {
      const txError = error instanceof LoanTxError ? error : null;
      const message = error instanceof Error ? error.message : 'Loan request could not be submitted';
      if (txError?.txHash) setTxHash(txError.txHash);
      setPhase('failed');
      setReasons([message]);
      setOutcome('declined');
      record({
        type: 'loan_declined',
        title: 'Loan request failed',
        description: message,
        tone: 'critical',
      });
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setAmount('');
    setOutcome('idle');
    setReasons([]);
    setApprovedLoanId(null);
    setPhase('idle');
    setTxHash(null);
  };

  const submitLabel = submitting ? phaseLabel(phase === 'idle' ? 'wallet' : phase) : 'Submit loan request';

  return (
    <ConnectGate
      title="Request a loan"
      description="Connect a wallet to review loan requirements and record a loan on 0G Galileo. The contract does not send principal to your wallet."
    >
      <div className="space-y-8">
        <PageHeader
          eyebrow={
            profile ? (
              <Badge tone={toneForLevel(profile.riskLevel)} dot>
                {ratingLabel(profile.riskLevel)} · {profile.creditScore}/1000
              </Badge>
            ) : null
          }
          title="Request a loan"
          description={`Fixed ${LOAN_TERMS.interestRate * 100}% interest over ${LOAN_TERMS.durationDays} days. Principal is recorded on Loan.sol as accounting data. A ${originationDepositEth()} 0G origination deposit is sent with the transaction.`}
        />

        <div className="grid gap-4 lg:grid-cols-[1fr_minmax(0,360px)]">
          <Card>
            <CardHeader
              title="Loan application"
              description="Enter an accounting principal. Loan.sol will not transfer this amount to you."
              icon={<Calculator className="h-4 w-4" />}
            />

            <CardBody className="pt-4">
              {outcome === 'idle' ? (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <Field
                    label="Accounting principal"
                    htmlFor="amount"
                    hint={`Guideline capacity ${formatEthCompact(guidelineMax)} 0G (${LOAN_TERMS.maxBalanceMultiple}× balance). Loan.sol does not enforce this cap.`}
                    error={guideline}
                    trailing={
                      <span className="text-xs text-ink-soft">
                        Balance {formatEth(balance)} {balanceSymbol}
                      </span>
                    }
                  >
                    <Input
                      id="amount"
                      type="number"
                      inputMode="decimal"
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                      sizeVariant="lg"
                      suffix="0G"
                      invalid={Boolean(guideline)}
                      required
                    />
                  </Field>

                  {guidelineMax > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {QUICK_FRACTIONS.map((fraction) => (
                        <button
                          key={fraction}
                          type="button"
                          onClick={() =>
                            setAmount(String(parseFloat((guidelineMax * fraction).toFixed(4))))
                          }
                          className="rounded-lg border border-hairline bg-surface px-3 py-1.5 text-xs font-semibold text-ink-muted transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800"
                        >
                          {fraction === 1 ? 'Max guideline' : `${fraction * 100}%`}
                        </button>
                      ))}
                    </div>
                  ) : null}

                  {hasAmount ? (
                    <div className="rounded-xl border border-hairline bg-surface-muted p-5">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-sm font-semibold">Repayment summary</p>
                        <Badge tone="neutral">{LOAN_TERMS.durationDays}-day term</Badge>
                      </div>

                      <StatRow
                        label="Recorded principal"
                        value={`${formatEthCompact(parsedAmount)} 0G`}
                      />
                      <StatRow
                        label={`Interest (${LOAN_TERMS.interestRate * 100}%)`}
                        value={`${formatEthCompact(interest)} 0G`}
                      />
                      <StatRow
                        label="Origination deposit (sent now)"
                        value={`${originationDepositEth()} 0G`}
                      />
                      <StatRow
                        label="Total repayment due later"
                        value={`${formatEthCompact(total)} 0G`}
                        tone="brand"
                      />
                      <StatRow label="Due date" value={formatDate(dueDate)} />

                      <div className="mt-4">
                        <div className="mb-2 flex items-center justify-between text-xs text-ink-muted">
                          <span>Guideline capacity used</span>
                          <span className="font-semibold tabular text-ink">
                            {Math.round(utilisation * 100)}%
                          </span>
                        </div>
                        <ProgressBar
                          value={utilisation}
                          tone={utilisation > 1 ? 'critical' : 'brand'}
                          label="Guideline capacity used"
                        />
                      </div>
                    </div>
                  ) : null}

                  <InlineNotice tone="info" icon={<Info className="h-4 w-4" />} title="Loan requirements">
                    <ul className="mt-1 space-y-1">
                      <li>
                        • Pay a {originationDepositEth()} 0G deposit when you submit. The contract
                        holds it. You do not receive the loan amount in your wallet.
                      </li>
                      <li>
                        • Keep at least {LOAN_TERMS.minBalanceEth} 0G in your wallet after the
                        deposit.
                      </li>
                      <li>
                        • The contract checks an on-chain activity counter (not your wallet nonce).
                        It must be at least {eligibility.minTxCount}. Yours:{' '}
                        {eligibility.ownerSetTxCount ?? '—'}/{eligibility.minTxCount}.
                      </li>
                      <li>
                        • One active loan per wallet. Your Credora score is informational only.
                      </li>
                    </ul>
                  </InlineNotice>

                  {eligibility.reasons.length > 0 ? (
                    <InlineNotice
                      tone="caution"
                      icon={<Info className="h-4 w-4" />}
                      title="Contract preflight"
                    >
                      <ul className="mt-1 space-y-1">
                        {eligibility.reasons.map((reason) => (
                          <li key={reason}>• {reason}</li>
                        ))}
                      </ul>
                    </InlineNotice>
                  ) : null}

                  {txHash ? (
                    <a
                      href={explorerTxUrl(txHash)}
                      target="_blank"
                      rel="noreferrer"
                      className="block text-xs font-medium text-brand-700 hover:underline"
                    >
                      View transaction {txHash.slice(0, 10)}…{txHash.slice(-6)}
                    </a>
                  ) : null}

                  <Button
                    type="submit"
                    size="lg"
                    fullWidth
                    loading={submitting}
                    disabled={!hasAmount || submitting}
                  >
                    {submitLabel}
                  </Button>
                </form>
              ) : outcome === 'approved' ? (
                <div className="py-4 text-center">
                  <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-positive-50 text-positive-600">
                    <CheckCircle2 className="h-7 w-7" />
                  </span>
                  <h3 className="mt-5 font-display text-2xl font-semibold">Loan recorded on-chain</h3>
                  <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-muted">
                    Loan.sol accepted the request and emitted LoanApproved. The principal is
                    accounting data on the contract — it was not sent to this wallet. The{' '}
                    {originationDepositEth()} 0G origination deposit remains in the contract.
                  </p>

                  <div className="mx-auto mt-6 max-w-sm rounded-xl border border-hairline bg-surface-muted p-5 text-left">
                    <StatRow label="Recorded principal" value={`${formatEthCompact(parsedAmount)} 0G`} />
                    <StatRow label="Interest" value={`${formatEthCompact(interest)} 0G`} />
                    <StatRow
                      label="Total repayment"
                      value={`${formatEthCompact(total)} 0G`}
                      tone="brand"
                    />
                    <StatRow label="Due" value={formatDate(dueDate)} />
                    {txHash ? (
                      <StatRow
                        label="Transaction"
                        value={
                          <a
                            href={explorerTxUrl(txHash)}
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium text-brand-700 hover:underline"
                          >
                            {txHash.slice(0, 10)}…{txHash.slice(-6)}
                          </a>
                        }
                      />
                    ) : null}
                  </div>

                  <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                    {approvedLoanId ? (
                      <Link
                        to={`/loans/${approvedLoanId}`}
                        className={buttonStyles('primary', 'md')}
                      >
                        View loan
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    ) : null}
                    <Button variant="secondary" onClick={reset}>
                      Request another
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="py-4 text-center">
                  <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-critical-50 text-critical-600">
                    <XCircle className="h-7 w-7" />
                  </span>
                  <h3 className="mt-5 font-display text-2xl font-semibold">Request did not complete</h3>
                  <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-muted">
                    No loan was created. A loan is only recorded after Loan.sol confirms the
                    transaction on 0G Galileo.
                  </p>

                  <ul className="mx-auto mt-6 max-w-sm space-y-2 rounded-xl border border-critical-100 bg-critical-50 p-5 text-left">
                    {reasons.map((reason) => (
                      <li key={reason} className="flex gap-2.5 text-sm text-critical-700">
                        <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        {reason}
                      </li>
                    ))}
                  </ul>

                  {txHash ? (
                    <a
                      href={explorerTxUrl(txHash)}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 inline-block text-sm font-medium text-brand-700 hover:underline"
                    >
                      View transaction
                    </a>
                  ) : null}

                  <Button variant="secondary" className="mt-6" onClick={reset}>
                    Adjust and try again
                  </Button>
                </div>
              )}
            </CardBody>
          </Card>

          <div className="space-y-4">
            <Card surface="brand" className="p-6">
              <p className="text-2xs font-semibold uppercase tracking-wider text-brand-200">
                Credit assessment
              </p>
              <p className="mt-3 font-display text-4xl font-semibold tabular tracking-tight text-white">
                {profile ? profile.creditScore : '—'}
                <span className="ml-2 text-base font-semibold text-brand-200">/1000</span>
              </p>
              <p className="mt-2 text-sm text-brand-100">
                Informational only. Loan.sol does not use this score to approve or reject a request.
              </p>

              <div className="mt-6 space-y-3 border-t border-white/10 pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-brand-100">Credit rating</span>
                  <span className="text-sm font-semibold text-white">
                    {profile ? ratingLabel(profile.riskLevel) : 'Unrated'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-brand-100">Guideline capacity</span>
                  <span className="text-sm font-semibold tabular text-white">
                    {formatEthCompact(guidelineMax)} 0G
                  </span>
                </div>
              </div>

              <Link
                to="/credit-score"
                className={buttonStyles('inverse', 'sm', 'mt-5 w-full')}
              >
                <Gauge className="h-4 w-4" />
                View assessment
              </Link>
            </Card>

            <Card>
              <CardHeader title="Current terms" icon={<ShieldCheck className="h-4 w-4" />} compact />
              <div className="px-5 pb-5 pt-2">
                <StatRow label="Interest rate" value={`${LOAN_TERMS.interestRate * 100}%`} tone="brand" />
                <StatRow
                  label="Origination deposit"
                  value={`${originationDepositEth()} 0G`}
                />
                <StatRow label="Principal disbursement" value="None" />
                <StatRow label="Loan duration" value={`${LOAN_TERMS.durationDays} days`} />
              </div>
            </Card>

            <Card>
              <CardHeader title="Your wallet" icon={<Wallet className="h-4 w-4" />} compact />
              <div className="px-5 pb-5 pt-2">
                <StatRow
                  label="Balance"
                  value={balance ? `${formatEth(balance)} ${balanceSymbol}` : '—'}
                />
                <StatRow
                  label="Owner-set tx counter"
                  value={
                    eligibility.ownerSetTxCount === null
                      ? '—'
                      : `${eligibility.ownerSetTxCount}/${eligibility.minTxCount}`
                  }
                  tone={
                    eligibility.ownerSetTxCount !== null &&
                    eligibility.ownerSetTxCount >= eligibility.minTxCount
                      ? 'positive'
                      : 'critical'
                  }
                />
                <StatRow
                  label="Active loan on contract"
                  value={eligibility.hasActiveLoan ? 'Yes' : eligibility.hasActiveLoan === false ? 'No' : '—'}
                />
              </div>
            </Card>
          </div>
        </div>
      </div>
    </ConnectGate>
  );
}
