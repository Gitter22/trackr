import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Navigate, useNavigate } from 'react-router';
import { z } from 'zod';
import { errorMessage } from '@/api/errors';
import { AuthCard } from '@/components/AuthCard';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { useAdminLogin, useAdminMe } from './api';

const schema = z.object({
  email: z.email('Enter a valid email'),
  password: z.string().min(1, 'Enter your password'),
});
type Values = z.infer<typeof schema>;

export function AdminLoginPage() {
  const me = useAdminMe();
  const login = useAdminLogin();
  const navigate = useNavigate();
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } });
  const { errors } = form.formState;

  if (me.data) return <Navigate to="/organizations" replace />;

  return (
    <AuthCard
      title="Sign in"
      description="Super admin access to the Trcker control panel."
      subtitle="Control panel"
    >
      <form
        className="grid gap-4"
        noValidate
        onSubmit={form.handleSubmit((v) => login.mutate(v, { onSuccess: () => navigate('/organizations') }))}
      >
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
