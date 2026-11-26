import Link from 'next/link';
import { redirect } from 'next/navigation';
import { signUpAction } from '../actions';
import { Alert, Field, buttonClass, inputClass } from '@/components/ui';
import { SubmitButton } from '@/components/submit-button';
import { getSessionUser, homePathForUser } from '@/lib/auth/session';
import { searchParam } from '@/lib/actions/helpers';
import { prisma } from '@/lib/db';

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getSessionUser();
  if (user) redirect(homePathForUser(user));

  const params = await searchParams;
  const error = searchParam(params, 'error');
  const userCount = await prisma.user.count();

  if (userCount > 0) {
    return (
      <>
        <h1 className="mb-1 text-xl font-semibold">Registration is closed</h1>
        <p className="mb-4 text-sm text-slate-600">
          This installation already has an administrator. Ask them to send you an invitation link,
          or sign in if you already have an account.
        </p>
        <Link href="/sign-in" className={`${buttonClass} block text-center`}>
          Go to sign in
        </Link>
      </>
    );
  }

  return (
    <>
      <h1 className="mb-1 text-xl font-semibold">Create the administrator account</h1>
      <p className="mb-4 text-sm text-slate-600">
        This is the first account for this installation, so it becomes the platform administrator.
        You can create organizations and invite people after signing in.
      </p>
      <Alert error={error} />
      <form action={signUpAction} className="space-y-4">
        <Field label="Your name">
          <input name="name" required autoComplete="name" className={inputClass} />
        </Field>
        <Field label="Email">
          <input name="email" type="email" required autoComplete="email" className={inputClass} />
        </Field>
        <Field label="Password" hint="At least 8 characters.">
          <input
            name="password"
            type="password"
            required
            autoComplete="new-password"
            className={inputClass}
          />
        </Field>
        <SubmitButton className={`${buttonClass} w-full`} pendingLabel="Creating…">
          Create administrator account
        </SubmitButton>
      </form>
      <p className="mt-4 text-sm text-slate-600">
        Already have an account?{' '}
        <Link href="/sign-in" className="font-medium text-slate-900">
          Sign in
        </Link>
      </p>
    </>
  );
}
