import Link from 'next/link';
import { redirect } from 'next/navigation';
import { signUpAction } from '../actions';
import { Alert, Field, buttonClass, inputClass } from '@/components/ui';
import { SubmitButton } from '@/components/submit-button';
import { getSessionUser, homePathForUser } from '@/lib/auth/session';
import { searchParam } from '@/lib/actions/helpers';

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getSessionUser();
  if (user) redirect(homePathForUser(user));

  const params = await searchParams;
  const error = searchParam(params, 'error');

  return (
    <>
      <h1 className="mb-1 text-xl font-semibold">Create your workspace</h1>
      <p className="mb-4 text-sm text-slate-600">
        Set up an organization for your rental portfolio. You become its owner.
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
        <Field label="Organization name">
          <input name="organizationName" required className={inputClass} />
        </Field>
        <Field label="Timezone" hint="Used to decide when rent is overdue.">
          <select name="timezone" defaultValue="Asia/Shanghai" className={inputClass}>
            <option value="Asia/Shanghai">Asia/Shanghai</option>
            <option value="Asia/Singapore">Asia/Singapore</option>
            <option value="Europe/London">Europe/London</option>
            <option value="America/New_York">America/New_York</option>
            <option value="America/Los_Angeles">America/Los_Angeles</option>
            <option value="UTC">UTC</option>
          </select>
        </Field>
        <SubmitButton className={`${buttonClass} w-full`} pendingLabel="Creating…">
          Create workspace
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
