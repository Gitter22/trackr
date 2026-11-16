import { Button } from '@/components/ui/button';
import { APP_DOMAIN } from '@/lib/config';
import { hostUrl } from '@/lib/host';

export function NotFound({
  message = "This workspace doesn't exist or is not active.",
}: {
  message?: string;
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-brand-50 p-6 text-center">
      <div>
        <p className="text-6xl font-bold text-primary">404</p>
        <p className="mt-3 text-muted-foreground">{message}</p>
        <Button asChild className="mt-6">
          <a href={hostUrl('marketing', window.location, APP_DOMAIN)}>Go to Trcker home</a>
        </Button>
      </div>
    </main>
  );
}
