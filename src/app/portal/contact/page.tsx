import { requireTenant } from '@/lib/auth/session';
import { updatePhoneAction } from '../actions';
import { searchParam } from '@/lib/actions/helpers';
import { Alert, Card, Field, PageHeader, buttonClass, inputClass } from '@/components/ui';
import { SubmitButton } from '@/components/submit-button';

export default async function PortalContactPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireTenant();
  const params = await searchParams;

  return (
    <>
      <PageHeader title="Contact details" subtitle="How the property owner reaches you." />
      <Alert error={searchParam(params, 'error')} ok={searchParam(params, 'ok')} />

      <Card title="Your details">
        <form action={updatePhoneAction} className="grid max-w-lg gap-4">
          <Field label="Name" hint="Ask the owner to change your name.">
            <input value={context.tenant.name} readOnly className={inputClass} />
          </Field>
          <Field label="Email" hint="Ask the owner to change your sign-in email.">
            <input value={context.tenant.email} readOnly className={inputClass} />
          </Field>
          <Field label="Phone">
            <input name="phone" defaultValue={context.tenant.phone ?? ''} className={inputClass} />
          </Field>
          <div>
            <SubmitButton className={buttonClass} pendingLabel="Saving…">
              Save phone number
            </SubmitButton>
          </div>
        </form>
      </Card>
    </>
  );
}
