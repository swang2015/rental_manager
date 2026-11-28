import Link from 'next/link';
import { redirect } from 'next/navigation';
import { signUpAction } from '../actions';
import { Alert, Field, buttonClass, inputClass } from '@/components/ui';
import { SubmitButton } from '@/components/submit-button';
import { getSessionUser, homePathForUser } from '@/lib/auth/session';
import { searchParam } from '@/lib/actions/helpers';
import { prisma } from '@/lib/db';

const TIMEZONES = [
  'Asia/Shanghai',
  'Asia/Singapore',
  'Europe/London',
  'America/New_York',
  'America/Los_Angeles',
  'UTC',
] as const;

function TimezoneField() {
  return (
    <Field label="Timezone" hint="Used to decide when rent is overdue.">
      <select name="timezone" defaultValue="Asia/Shanghai" className={inputClass}>
        {TIMEZONES.map((timezone) => (
          <option key={timezone} value={timezone}>
            {timezone}
          </option>
        ))}
      </select>
    </Field>
  );
}

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
  const isFirstAccount = userCount === 0;

  return (
    <>
      <h1 className="mb-1 text-xl font-semibold">
        {isFirstAccount ? 'Create the administrator account' : 'Request an account'}
      </h1>
      <p className="mb-4 text-sm text-slate-600">
        {isFirstAccount
          ? 'This is the first account for this installation, so it becomes the platform administrator.'
          : 'Tell us how you use RentEase. A platform administrator reviews new accounts before they can sign in.'}
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

        {isFirstAccount ? (
          <TimezoneField />
        ) : (
          <>
            <Field label="I am a">
              <select name="requestedRole" defaultValue="OWNER" className={inputClass}>
                <option value="OWNER">Property owner</option>
                <option value="TENANT">Tenant</option>
                <option value="VENDOR">Vendor / contractor</option>
              </select>
            </Field>
            <Field label="Phone (optional)">
              <input name="phone" autoComplete="tel" className={inputClass} />
            </Field>
            <TimezoneField />
          </>
        )}

        <SubmitButton className={`${buttonClass} w-full`} pendingLabel="Submitting…">
          {isFirstAccount ? 'Create administrator account' : 'Request access'}
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
