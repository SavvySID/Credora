import { Navigate, Route, Routes } from 'react-router-dom';
import { MarketingLayout } from './components/layout/MarketingLayout';
import { AppShell } from './components/layout/AppShell';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import CreditScore from './pages/CreditScore';
import Loans from './pages/Loans';
import LoanDetails from './pages/LoanDetails';
import Borrow from './pages/Borrow';
import ActivityPage from './pages/Activity';
import Account from './pages/Account';
import Lender from './pages/Lender';
import LenderBorrower from './pages/LenderBorrower';
import Analytics from './pages/Analytics';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <Routes>
      <Route element={<MarketingLayout />}>
        <Route path="/" element={<Landing />} />
      </Route>

      <Route element={<AppShell />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/credit-score" element={<CreditScore />} />
        <Route path="/loans" element={<Loans />} />
        <Route path="/loans/:loanId" element={<LoanDetails />} />
        <Route path="/borrow" element={<Borrow />} />
        <Route path="/activity" element={<ActivityPage />} />
        <Route path="/account" element={<Account />} />
        <Route path="/lender" element={<Lender />} />
        <Route path="/lender/:address" element={<LenderBorrower />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="*" element={<NotFound />} />
      </Route>

      {/* Kept so older /loan-request links still reach Borrow. */}
      <Route path="/loan-request" element={<Navigate to="/borrow" replace />} />
    </Routes>
  );
}
