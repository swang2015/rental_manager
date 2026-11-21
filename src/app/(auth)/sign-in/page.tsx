import Link from 'next/link';
import { redirect } from 'next/navigation';
import { signInAction } from '../actions';
import { Alert, Field, buttonClass, inputClass } from '@/components/ui';
import { SubmitButton } from '@/components/submit-button';
import { getSessionUser, homePathForUser } from '@/lib/auth/session';
import { searchParam } from '@/lib/actions/helpers';

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getSessionUser();
  if (user) redirect(homePathForUser(user));

  const params = await searchParams;
  const error = searchParam(params, 'error');
  const returnTo = searchParam(params, 'returnTo') ?? '/';

  return (
    <>
      <h1 className="mb-1 text-xl font-semibold">Sign in</h1>
      <p className="mb-4 text-sm text-slate-600">Manage your rentals or check your tenancy.</p>
      <Alert error={error} />
      <form action={signInAction} className="space-y-4">
        <input type="hidden" name="returnTo" value={returnTo} />
        <Field label="Email">
          <input name="email" type="email" required autoComplete="email" className={inputClass} />
        </Field>
        <Field label="Password">
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className={inputClass}
          />
        </Field>
        <SubmitButton className={`${buttonClass} w-full`} pendingLabel="Signing in…">
          Sign in
        </SubmitButton>
      </form>
      <p className="mt-4 text-sm text-slate-600">
        No account yet?{' '}
        <Link href="/sign-up" className="font-medium text-slate-900">
          Create one
        </Link>
      </p>
    </>
  );
}
