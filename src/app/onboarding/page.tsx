import { redirect } from 'next/navigation';
import { signOutAction } from '../session-actions';
import { Card, secondaryButtonClass } from '@/components/ui';
import { SubmitButton } from '@/components/submit-button';
import { getSessionUser } from '@/lib/auth/session';

export default async function OnboardingPage() {
  const user = await getSessionUser();
  if (!user) redirect('/sign-in');
  if (user.isSuperAdmin) redirect('/admin');
  if (user.memberships.length > 0) redirect('/dashboard');
  if (user.tenantRecords.length > 0) redirect('/portal');

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <h1 className="text-2xl font-semibold">Welcome, {user.name}</h1>
      <p className="mt-1 mb-6 text-sm text-slate-600">
        Your account is not linked to an organization yet. Organizations are created by the platform
        administrator; ask them to send you an invitation link. Once you accept it, this account
        opens the right workspace automatically.
      </p>
      <Card title="Waiting for an invitation">
        <p className="text-sm text-slate-600">
          Invitations expire after 7 days and only work for the email address they were sent to. If
          your link has expired, ask the administrator for a new one.
        </p>
      </Card>
      <form action={signOutAction} className="mt-6">
        <SubmitButton className={secondaryButtonClass}>Sign out</SubmitButton>
      </form>
    </div>
  );
}
