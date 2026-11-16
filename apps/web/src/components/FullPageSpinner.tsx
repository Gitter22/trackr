import { Loader2 } from 'lucide-react';

export function FullPageSpinner() {
  return (
    <div className="grid min-h-screen place-items-center" aria-busy="true">
      <Loader2 className="size-6 animate-spin text-primary" aria-label="Loading" />
    </div>
  );
}
