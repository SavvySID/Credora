import {
  Activity,
  BadgeDollarSign,
  Gauge,
  LayoutDashboard,
  LineChart,
  Search,
  User,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  /** Shown in the mobile tab bar. */
  primary?: boolean;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Overview',
    items: [
      {
        to: '/dashboard',
        label: 'Dashboard',
        shortLabel: 'Home',
        icon: LayoutDashboard,
        primary: true,
      },
      {
        to: '/credit-score',
        label: 'Credit score',
        shortLabel: 'Score',
        icon: Gauge,
        primary: true,
      },
    ],
  },
  {
    title: 'Borrowing',
    items: [
      {
        to: '/loans',
        label: 'Loans',
        shortLabel: 'Loans',
        icon: BadgeDollarSign,
        primary: true,
      },
      {
        to: '/borrow',
        label: 'Request a loan',
        shortLabel: 'Borrow',
        icon: Wallet,
        primary: true,
      },
    ],
  },
  {
    title: 'Records',
    items: [
      {
        to: '/activity',
        label: 'Activity',
        shortLabel: 'Activity',
        icon: Activity,
        primary: true,
      },
      { to: '/account', label: 'Account', shortLabel: 'Account', icon: User },
    ],
  },
  {
    title: 'Intelligence',
    items: [
      {
        to: '/lender',
        label: 'Lender desk',
        shortLabel: 'Lender',
        icon: Search,
      },
      {
        to: '/analytics',
        label: 'Analytics',
        shortLabel: 'Analytics',
        icon: LineChart,
      },
    ],
  },
];

export const ALL_NAV_ITEMS = NAV_SECTIONS.flatMap((section) => section.items);

export const PRIMARY_NAV_ITEMS = ALL_NAV_ITEMS.filter((item) => item.primary);
