import Link from 'next/link';
import { hasRole, requireManager } from '@/lib/auth/session';
import { signOutAction } from '../session-actions';
import { SubmitButton } from '@/components/submit-button';

const NAV = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/properties', label: 'Properties' },
  { href: '/tenants', label: 'Tenants' },
  { href: '/leases', label: 'Leases' },
  { href: '/rent', label: 'Rent' },
  { href: '/maintenance', label: 'Maintenance' },
  { href: '/vendors', label: 'Vendors' },
];

export default async function ManagerLayout({ children }: { children: React.ReactNode }) {
  const context = await requireManager();
  const user = context.user;

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-sm font-semibold">{context.owner.name}</p>
            <p className="text-xs text-slate-500">
              {user.name} · {context.isSuperAdmin ? 'Superadmin' : 'Owner'}
            </p>
          </div>
          <form action={signOutAction}>
            <SubmitButton className="text-sm text-slate-600 underline">Sign out</SubmitButton>
          </form>
        </div>
        <nav className="mx-auto flex max-w-6xl flex-wrap gap-1 px-4 pb-2">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-1.5 text-sm text-slate-700 no-underline hover:bg-slate-100"
            >
              {item.label}
            </Link>
          ))}
          {hasRole(user, 'TENANT') && user.tenancies.length > 0 ? (
            <Link
              href="/portal"
              className="rounded-md px-3 py-1.5 text-sm text-emerald-800 no-underline hover:bg-emerald-50"
            >
              Tenant portal
            </Link>
          ) : null}
          {hasRole(user, 'VENDOR') && user.vendors.length > 0 ? (
            <Link
              href="/vendor"
              className="rounded-md px-3 py-1.5 text-sm text-amber-800 no-underline hover:bg-amber-50"
            >
              Vendor portal
            </Link>
          ) : null}
          {context.isSuperAdmin ? (
            <Link
              href="/admin"
              className="rounded-md px-3 py-1.5 text-sm text-sky-800 no-underline hover:bg-sky-50"
            >
              Platform admin
            </Link>
          ) : null}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
