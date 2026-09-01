import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/Feedback';
import { buttonStyles } from '@/components/ui/Button';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl py-10">
      <Card>
        <EmptyState
          icon={<Compass className="h-5 w-5" />}
          title="Page not found"
          description="That route does not exist in Credora. Head back to your dashboard to pick up where you left off."
          action={
            <Link to="/dashboard" className={buttonStyles('primary', 'md')}>
              Go to dashboard
            </Link>
          }
        />
      </Card>
    </div>
  );
}
