import { redirect } from 'next/navigation';
import { createOrganizationAction } from './actions';
import { signOutAction } from '../session-actions';
import { Alert, Card, Field, buttonClass, inputClass, secondaryButtonClass } from '@/components/ui';
import { SubmitButton } from '@/components/submit-button';
import { getSessionUser } from '@/lib/auth/session';
import { searchParam } from '@/lib/actions/helpers';

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getSessionUser();
  if (!user) redirect('/sign-in');
  if (user.memberships.length > 0) redirect('/dashboard');
  if (user.tenantRecords.length > 0) redirect('/portal');

  const params = await searchParams;

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <h1 className="text-2xl font-semibold">Welcome, {user.name}</h1>
      <p className="mt-1 mb-6 text-sm text-slate-600">
        Your account is not linked to a workspace yet. Create an organization, or accept the
        invitation an owner sent you.
      </p>
      <Alert error={searchParam(params, 'error')} />
      <Card title="Create an organization">
        <form action={createOrganizationAction} className="space-y-4">
          <Field label="Organization name">
            <input name="name" required className={inputClass} />
          </Field>
          <Field label="Timezone">
            <select name="timezone" defaultValue="Asia/Shanghai" className={inputClass}>
              <option value="Asia/Shanghai">Asia/Shanghai</option>
              <option value="Asia/Singapore">Asia/Singapore</option>
              <option value="Europe/London">Europe/London</option>
              <option value="America/New_York">America/New_York</option>
              <option value="America/Los_Angeles">America/Los_Angeles</option>
              <option value="UTC">UTC</option>
            </select>
          </Field>
          <SubmitButton className={buttonClass} pendingLabel="Creating…">
            Create organization
          </SubmitButton>
        </form>
      </Card>
      <form action={signOutAction} className="mt-6">
        <SubmitButton className={secondaryButtonClass}>Sign out</SubmitButton>
      </form>
    </div>
  );
}
