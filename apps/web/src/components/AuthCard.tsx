import type { ReactNode } from 'react';
import { Logo } from '@/components/Logo';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';

/** Centered card used by every sign-in page. */
export function AuthCard({
  title,
  description,
  subtitle,
  children,
}: {
  title: string;
  description: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-gradient-to-br from-brand-50 via-white to-brand-100 p-4">
      <div className="w-full max-w-sm">
        <Logo className="mb-6 justify-center" subtitle={subtitle} />
        <Card>
          <CardHeader>
            <h1 className="text-xl leading-none font-semibold">{title}</h1>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>
      </div>
    </main>
  );
}
