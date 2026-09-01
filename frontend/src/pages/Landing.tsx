import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  Boxes,
  Clock3,
  Cpu,
  Database,
  Globe2,
  Radio,
  ScrollText,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { buttonStyles } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ScoreGauge } from '@/components/charts/ScoreGauge';
import { LOAN_TERMS } from '@/lib/loans';

const FEATURES = [
  {
    icon: Cpu,
    title: 'Deterministic scoring',
    body: 'Wallet balance, transaction volume and activity recency are scored with credora-onchain-v1 — a deterministic model, not trained ML.',
  },
  {
    icon: ShieldCheck,
    title: 'Secure and transparent',
    body: 'Terms are enforced by smart contract. No intermediaries, no hidden fees, no discretionary overrides.',
  },
  {
    icon: BarChart3,
    title: 'Rates you can read',
    body: `A single fixed rate of ${LOAN_TERMS.interestRate * 100}% over ${LOAN_TERMS.durationDays} days. The number you see is the number you repay.`,
  },
  {
    icon: Globe2,
    title: 'Open access',
    body: 'Any wallet on 0G Galileo. Credit scoring uses public chain history. Loan.sol approval uses its own owner-set borrower counter and deposit rules.',
  },
  {
    icon: Wallet,
    title: 'Connect and borrow',
    body: 'Bring an existing Web3 wallet. Credora reads public activity and never takes custody of your assets.',
  },
  {
    icon: Boxes,
    title: 'Built on 0G',
    body: 'Storage, compute and streaming run on 0G infrastructure so every assessment is reproducible.',
  },
];

const STEPS = [
  {
    title: 'Connect your wallet',
    body: 'Link a Web3 wallet. Credora reads public on-chain data only — signing never moves funds.',
  },
  {
    title: 'Receive your assessment',
    body: 'The scoring model returns a score out of 1000, a rating band, and the factors behind it.',
  },
  {
    title: 'Borrow and repay',
    body: `Submit an on-chain loan request. Loan.sol records the principal as accounting data and does not send it to your wallet. Repay principal plus ${LOAN_TERMS.interestRate * 100}% within ${LOAN_TERMS.durationDays} days.`,
  },
];

const TERMS = [
  { label: 'Interest rate', value: `${LOAN_TERMS.interestRate * 100}%`, note: 'Fixed for the full term' },
  { label: 'Loan duration', value: `${LOAN_TERMS.durationDays} days`, note: 'Single repayment at term end' },
  { label: 'Origination deposit', value: '0.5 0G', note: 'Sent with requestLoan; held by the contract' },
  { label: 'Early repayment', value: 'No penalty', note: 'Settle whenever you choose' },
];

const INFRASTRUCTURE = [
  {
    icon: Database,
    name: '0G Storage',
    body: 'Wallet profiles, transaction records and lending history are written to durable, verifiable storage.',
  },
  {
    icon: Cpu,
    name: '0G Compute',
    body: 'The credit model runs as an inference job, returning a score, a confidence value and weighted factors.',
  },
  {
    icon: Radio,
    name: '0G Pipeline',
    body: 'Score, transaction and lending events stream back to the interface as they are published.',
  },
];

export default function Landing() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-6xl px-4 pb-16 pt-14 sm:px-6 sm:pb-20 sm:pt-20">
          <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
            <div>
              <h1 className="font-display text-display-hero font-semibold">
                Credit that reads your{' '}
                <span className="bg-gradient-to-r from-viz-1 to-viz-3 bg-clip-text text-transparent">
                  on-chain history
                </span>
              </h1>

              <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-muted sm:text-lg">
                Credora turns wallet activity into a transparent credit assessment, then lends
                against it on fixed, contract-enforced terms. No paperwork, no intermediaries, no
                discretionary pricing.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link to="/dashboard" className={buttonStyles('primary', 'lg')}>
                  Open the app
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link to="/borrow" className={buttonStyles('secondary', 'lg')}>
                  Request a loan
                </Link>
              </div>

              <dl className="mt-10 grid max-w-md grid-cols-3 gap-6 border-t border-hairline pt-6">
                {[
                  { label: 'Fixed rate', value: `${LOAN_TERMS.interestRate * 100}%` },
                  { label: 'Term', value: `${LOAN_TERMS.durationDays}d` },
                  { label: 'Fees', value: '0%' },
                ].map((stat) => (
                  <div key={stat.label}>
                    <dt className="text-2xs font-semibold uppercase tracking-wider text-ink-faint">
                      {stat.label}
                    </dt>
                    <dd className="mt-1 font-display text-2xl font-semibold tabular tracking-tight">
                      {stat.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* Product surface preview — shows the real assessment layout, not an abstract illustration. */}
            <div className="relative">
              <div
                className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-gradient-to-br from-brand-400/25 via-transparent to-caution-500/15 blur-2xl"
                aria-hidden
              />
              <Card elevation="floating" className="overflow-hidden">
                <div className="flex items-center justify-between border-b border-hairline-soft px-6 py-4">
                  <div>
                    <p className="text-2xs font-semibold uppercase tracking-wider text-ink-faint">
                      Credit assessment
                    </p>
                    <p className="mt-0.5 text-sm font-semibold">Wallet overview</p>
                  </div>
                  <Badge tone="positive" dot pulse>
                    Live
                  </Badge>
                </div>

                <div className="flex flex-col items-center px-6 py-8">
                  <ScoreGauge score={782} tone="positive" size={208} label="Excellent" />
                </div>

                <div className="grid grid-cols-3 divide-x divide-hairline-soft border-t border-hairline-soft">
                  {[
                    { label: 'Balance', value: '2.4180' },
                    { label: 'Transactions', value: '184' },
                    { label: 'Confidence', value: '85%' },
                  ].map((item) => (
                    <div key={item.label} className="px-4 py-4 text-center">
                      <p className="text-2xs uppercase tracking-wider text-ink-faint">
                        {item.label}
                      </p>
                      <p className="mt-1 font-display text-base font-semibold tabular">
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>
              </Card>

              <p className="mt-3 text-center text-2xs text-ink-faint">
                Illustrative wallet. Your own assessment is generated on connect.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="credit" className="border-t border-hairline bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="max-w-2xl">
            <h2 className="font-display text-display-sm font-semibold sm:text-display-md">
              Lending built on evidence
            </h2>
            <p className="mt-3 text-base leading-relaxed text-ink-muted">
              Every decision traces back to data you can inspect and terms you can verify.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <Card key={feature.title} interactive className="p-6">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                  <feature.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-base font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">{feature.body}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="border-t border-hairline">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
            <div>
              <h2 className="font-display text-display-sm font-semibold sm:text-display-md">
                Three steps, start to funded
              </h2>
              <p className="mt-3 text-base leading-relaxed text-ink-muted">
                The whole flow runs in the browser against your wallet.
              </p>
            </div>

            <ol className="space-y-3">
              {STEPS.map((step, index) => (
                <li key={step.title}>
                  <Card className="flex gap-5 p-6">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brandsolid font-display text-sm font-semibold text-brandsolid-fg">
                      {index + 1}
                    </span>
                    <div>
                      <h3 className="text-base font-semibold">{step.title}</h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{step.body}</p>
                    </div>
                  </Card>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* Terms */}
      <section id="terms" className="border-t border-hairline bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-2xl">
              <h2 className="font-display text-display-sm font-semibold sm:text-display-md">
                One rate. No surprises.
              </h2>
              <p className="mt-3 text-base leading-relaxed text-ink-muted">
                These terms are constants in the Credora loan contract, identical for every borrower.
              </p>
            </div>
            <Link to="/borrow" className={buttonStyles('secondary', 'md')}>
              <ScrollText className="h-4 w-4" />
              Review full terms
            </Link>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {TERMS.map((term) => (
              <Card key={term.label} className="p-6">
                <p className="text-2xs font-semibold uppercase tracking-wider text-ink-faint">
                  {term.label}
                </p>
                <p className="mt-3 font-display text-3xl font-semibold tabular tracking-tight text-brand-800">
                  {term.value}
                </p>
                <p className="mt-2 text-xs text-ink-muted">{term.note}</p>
              </Card>
            ))}
          </div>

          <div className="mt-6 flex items-start gap-3 rounded-xl border border-hairline bg-surface-muted px-5 py-4">
            <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-ink-soft" />
            <p className="text-sm leading-relaxed text-ink-muted">
              Eligibility requires a wallet balance above {LOAN_TERMS.minBalanceEth} 0G, and requests
              are capped at {LOAN_TERMS.maxBalanceMultiple}× your balance.
            </p>
          </div>
        </div>
      </section>

      {/* Infrastructure */}
      <section id="infrastructure" className="border-t border-hairline">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <Card surface="brand" elevation="floating" className="relative overflow-hidden">
            <div className="absolute inset-0 cd-grid-texture opacity-50" aria-hidden />
            <div className="relative px-6 py-12 sm:px-12 sm:py-14">
              <div className="max-w-2xl">
                <Badge tone="brand" className="bg-white/10 text-brand-100 ring-white/15">
                  Infrastructure
                </Badge>
                <h2 className="mt-5 font-display text-display-sm font-semibold text-white sm:text-display-md">
                  Powered by 0G underneath
                </h2>
                <p className="mt-3 text-base leading-relaxed text-brand-100">
                  Credora runs its data, inference and streaming layers on 0G, so assessments stay
                  reproducible and records stay verifiable.
                </p>
              </div>

              <div className="mt-10 grid gap-4 sm:grid-cols-3">
                {INFRASTRUCTURE.map((service) => (
                  <div
                    key={service.name}
                    className="rounded-card border border-white/10 bg-white/5 p-5"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-brand-200">
                      <service.icon className="h-4 w-4" />
                    </span>
                    <h3 className="mt-4 text-sm font-semibold text-white">{service.name}</h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-brand-100">{service.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="border-t border-hairline bg-surface">
        <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6">
          <h2 className="font-display text-display-sm font-semibold sm:text-display-md">
            See what your wallet qualifies for
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-base leading-relaxed text-ink-muted">
            Connect to generate your assessment. It takes a few seconds and costs nothing.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link to="/dashboard" className={buttonStyles('primary', 'lg')}>
              Open the app
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/credit-score" className={buttonStyles('secondary', 'lg')}>
              View credit model
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
