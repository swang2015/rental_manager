import Link from 'next/link';
import { hasRole, requireVendor } from '@/lib/auth/session';
import { signOutAction } from '../session-actions';
import { SubmitButton } from '@/components/submit-button';

export default async function VendorLayout({ children }: { children: React.ReactNode }) {
  const context = await requireVendor();
  const user = context.user;

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-sm font-semibold">
              {context.vendor.company ?? context.vendor.name} · Vendor portal
            </p>
            <p className="text-xs text-slate-500">{user.email}</p>
          </div>
          <form action={signOutAction}>
            <SubmitButton className="text-sm text-slate-600 underline">Sign out</SubmitButton>
          </form>
        </div>
        <nav className="mx-auto flex max-w-4xl flex-wrap gap-1 px-4 pb-2">
          <Link
            href="/vendor"
            className="rounded-md px-3 py-1.5 text-sm text-slate-700 no-underline hover:bg-slate-100"
          >
            Work orders
          </Link>
          {hasRole(user, 'OWNER') ? (
            <Link
              href="/dashboard"
              className="rounded-md px-3 py-1.5 text-sm text-sky-800 no-underline hover:bg-sky-50"
            >
              My properties
            </Link>
          ) : null}
          {hasRole(user, 'TENANT') && user.tenancies.length > 0 ? (
            <Link
              href="/portal"
              className="rounded-md px-3 py-1.5 text-sm text-emerald-800 no-underline hover:bg-emerald-50"
            >
              Tenant portal
            </Link>
          ) : null}
        </nav>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
    </div>
  );
}
