import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Field, Input } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

export function BorrowerLookup({ initial = '' }: { initial?: string }) {
  const navigate = useNavigate();
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
      onSubmit={(event) => {
        event.preventDefault();
        if (!ADDRESS.test(value.trim())) {
          setError('Enter a 0x EVM address.');
          return;
        }
        setError(null);
        navigate(`/lender/${value.trim().toLowerCase()}`);
      }}
    >
      <Field label="Borrower wallet" className="flex-1" error={error ?? undefined}>
        <Input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="0x…"
          autoComplete="off"
          spellCheck={false}
        />
      </Field>
      <Button type="submit" iconLeft={<Search className="h-4 w-4" />}>
        Look up
      </Button>
    </form>
  );
}
