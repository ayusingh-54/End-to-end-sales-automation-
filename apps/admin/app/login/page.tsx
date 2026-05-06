import { LoginForm } from './form';

export const dynamic = 'force-dynamic';

export default function LoginPage() {
  return (
    <main className="mx-auto max-w-sm px-6 py-24">
      <h1 className="text-2xl font-semibold tracking-tight">LWL Admin</h1>
      <p className="mt-1 text-sm text-neutral-500">Sign in with your email and password.</p>
      <LoginForm />
    </main>
  );
}
