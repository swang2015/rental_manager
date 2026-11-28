import { redirect } from 'next/navigation';
import { signOutAction } from '../session-actions';
import { Card, secondaryButtonClass } from '@/components/ui';
import { SubmitButton } from '@/components/submit-button';
import { getSessionUser, hasRole } from '@/lib/auth/session';

const ROLE_LABEL: Record<string, string> = {
  OWNER: 'property owner',
  TENANT: 'tenant',
  VENDOR: 'vendor',
};

export default async function OnboardingPage() {
  const user = await getSessionUser();
  if (!user) redirect('/sign-in');
  if (user.isSuperAdmin) redirect('/admin');
  if (hasRole(user, 'OWNER')) redirect('/dashboard');
  if (hasRole(user, 'VENDOR') && user.vendors.length > 0) redirect('/vendor');
  if (hasRole(user, 'TENANT') && user.tenancies.length > 0) redirect('/portal');

  const pending = user.status === 'PENDING';
  const waitingForOwner = hasRole(user, 'TENANT') || hasRole(user, 'VENDOR');

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <h1 className="text-2xl font-semibold">Welcome, {user.name}</h1>
      <p className="mt-1 mb-6 text-sm text-slate-600">
        {pending
          ? 'Your account request is waiting for a platform administrator to review it.'
          : waitingForOwner
            ? 'Your account is approved, but an owner has not linked you to their portfolio yet.'
            : 'Your account does not have an active role on this platform yet.'}
      </p>
      <Card title={pending ? 'Account under review' : 'Waiting for an invitation'}>
        <p className="text-sm text-slate-600">
          {user.requestedRole
            ? `You asked to join as a ${ROLE_LABEL[user.requestedRole] ?? user.requestedRole.toLowerCase()}. `
            : ''}
          {waitingForOwner
            ? 'Ask the property owner to send you an invitation link from their workspace. The link is valid for 7 days and only works for this email address.'
            : 'A platform administrator will approve your account. You can sign in again later to check the status.'}
        </p>
      </Card>
      <form action={signOutAction} className="mt-6">
        <SubmitButton className={secondaryButtonClass}>Sign out</SubmitButton>
      </form>
    </div>
  );
}
