import Link from 'next/link';
import { acceptInvitationAction } from '../../actions';
import { Alert, Field, buttonClass, inputClass } from '@/components/ui';
import { SubmitButton } from '@/components/submit-button';
import { findInvitationByToken, invitationPath } from '@/lib/auth/invitations';
import { searchParam } from '@/lib/actions/helpers';

const ROLE_LABEL: Record<string, string> = {
  OWNER: 'property owner',
  TENANT: 'tenant',
  VENDOR: 'vendor',
};

export default async function AcceptInvitationPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token } = await params;
  const query = await searchParams;
  const error = searchParam(query, 'error');
  const invitation = await findInvitationByToken(token);

  if (!invitation || invitation.acceptedAt || invitation.expiresAt.getTime() <= Date.now()) {
    return (
      <>
        <h1 className="mb-1 text-xl font-semibold">Invitation unavailable</h1>
        <p className="mt-2 text-sm text-slate-600">
          {invitation?.acceptedAt
            ? 'This invitation has already been used. Sign in to continue.'
            : 'This invitation has expired or does not exist. Ask for a new one.'}
        </p>
        <p className="mt-4 text-sm">
          <Link href="/sign-in" className="font-medium text-slate-900">
            Go to sign in
          </Link>
        </p>
      </>
    );
  }

  const headline =
    invitation.role === 'OWNER'
      ? 'Join RentEase'
      : `Join ${invitation.owner?.name ?? 'an owner'}'s portfolio`;

  return (
    <>
      <h1 className="mb-1 text-xl font-semibold">{headline}</h1>
      <p className="mb-4 text-sm text-slate-600">
        Invitation for <strong>{invitation.email}</strong> as a{' '}
        {ROLE_LABEL[invitation.role] ?? invitation.role.toLowerCase()}. If an account with this
        email already exists, enter its password to confirm.
      </p>
      <Alert error={error} />
      <form action={acceptInvitationAction} className="space-y-4">
        <input type="hidden" name="token" value={token} />
        <Field label="Your name">
          <input name="name" autoComplete="name" className={inputClass} />
        </Field>
        <Field label="Password" hint="At least 8 characters for a new account.">
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className={inputClass}
          />
        </Field>
        <SubmitButton className={`${buttonClass} w-full`} pendingLabel="Joining…">
          Accept invitation
        </SubmitButton>
      </form>
      <p className="mt-4 text-xs text-slate-500">
        Invitation link: <code>{invitationPath(token)}</code>
      </p>
    </>
  );
}
