import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Navigate, useNavigate } from 'react-router';
import { z } from 'zod';
import { errorMessage } from '@/api/errors';
import { AuthCard } from '@/components/AuthCard';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { useTenantSession, type SessionUser } from './session';

const schema = z.object({
  email: z.email('Enter a valid email'),
  password: z.string().min(1, 'Enter your password'),
});
type Values = z.infer<typeof schema>;

export function TenantLoginPage({ orgTitle }: { orgTitle: string }) {
  const { api, signIn, token } = useTenantSession();
  const navigate = useNavigate();
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } });
  const { errors } = form.formState;
  const login = useMutation({
    mutationFn: async (v: Values) =>
      (await api.post<{ token: string; user: SessionUser }>('/auth/login', v)).data,
    onSuccess: ({ token }) => {
      signIn(token);
      navigate('/projects', { replace: true });
    },
  });

  if (token) return <Navigate to="/projects" replace />;

  return (
    <AuthCard
      title={`Sign in to ${orgTitle}`}
      description="Use the email your workspace owner set up for you."
      subtitle={orgTitle}
    >
      <form className="grid gap-4" noValidate onSubmit={form.handleSubmit((v) => login.mutate(v))}>
        {login.isError && <Alert>{errorMessage(login.error)}</Alert>}
        <FormField label="Email" htmlFor="email" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="username"
            aria-invalid={!!errors.email}
            {...form.register('email')}
          />
        </FormField>
        <FormField label="Password" htmlFor="password" error={errors.password?.message}>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            aria-invalid={!!errors.password}
            {...form.register('password')}
          />
        </FormField>
        <Button type="submit" disabled={login.isPending}>
          {login.isPending ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </AuthCard>
  );
}
