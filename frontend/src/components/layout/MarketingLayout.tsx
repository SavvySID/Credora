import { useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { Logo } from './Logo';
import { buttonStyles } from '@/components/ui/Button';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { cn } from '@/lib/utils';

const SECTIONS = [
  { href: '#how-it-works', label: 'How it works' },
  { href: '#credit', label: 'Credit model' },
  { href: '#terms', label: 'Terms' },
  { href: '#infrastructure', label: 'Infrastructure' },
];

function MarketingHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-hairline cd-glass">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-4 sm:px-6">
        <Link to="/" aria-label="Credora home">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {SECTIONS.map((section) => (
            <a
              key={section.href}
              href={section.href}
              className="text-sm font-medium text-ink-muted transition-colors hover:text-ink"
            >
              {section.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle tooltipAlign="right" />
          <Link to="/dashboard" className={buttonStyles('primary', 'sm', 'hidden sm:inline-flex')}>
            Open app
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-hairline bg-surface text-ink-muted md:hidden"
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {open ? (
        <div className="border-t border-hairline bg-surface px-4 py-4 md:hidden">
          <nav className="flex flex-col gap-1">
            {SECTIONS.map((section) => (
              <a
                key={section.href}
                href={section.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-ink-muted hover:bg-surface-inset hover:text-ink"
              >
                {section.label}
              </a>
            ))}
          </nav>
          <Link
            to="/dashboard"
            onClick={() => setOpen(false)}
            className={buttonStyles('primary', 'md', 'mt-3 w-full')}
          >
            Open app
          </Link>
        </div>
      ) : null}
    </header>
  );
}

function MarketingFooter() {
  const columns = [
    {
      title: 'Product',
      links: [
        { to: '/dashboard', label: 'Dashboard' },
        { to: '/credit-score', label: 'Credit score' },
        { to: '/loans', label: 'Loans' },
        { to: '/borrow', label: 'Request a loan' },
      ],
    },
    {
      title: 'Records',
      links: [
        { to: '/activity', label: 'Activity' },
        { to: '/account', label: 'Account' },
      ],
    },
  ];

  return (
    <footer className="border-t border-hairline bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink-muted">
              An AI-powered lending protocol delivering fair, transparent and data-driven credit
              decisions on-chain.
            </p>
          </div>

          {columns.map((column) => (
            <div key={column.title}>
              <p className="text-2xs font-semibold uppercase tracking-wider text-ink-faint">
                {column.title}
              </p>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.to}>
                    <Link
                      to={link.to}
                      className="text-sm text-ink-muted transition-colors hover:text-ink"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-hairline-soft pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-ink-soft">© 2025 Credora. All rights reserved.</p>
          <p className="text-xs text-ink-soft">
            Built on Ethereum · Credit infrastructure by 0G
          </p>
        </div>
      </div>
    </footer>
  );
}

export function MarketingLayout() {
  return (
    <div className={cn('min-h-screen bg-canvas')}>
      <MarketingHeader />
      <Outlet />
      <MarketingFooter />
    </div>
  );
}
