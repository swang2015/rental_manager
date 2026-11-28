import Link from 'next/link';
import { requireTenant } from '@/lib/auth/session';
import { signOutAction } from '../session-actions';
import { SubmitButton } from '@/components/submit-button';

const NAV = [
  { href: '/portal', label: 'Home' },
  { href: '/portal/lease', label: 'Lease' },
  { href: '/portal/rent', label: 'Rent' },
  { href: '/portal/maintenance', label: 'Maintenance' },
  { href: '/portal/contact', label: 'Contact' },
];

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const context = await requireTenant();

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-sm font-semibold">{context.owner.name} · Tenant portal</p>
            <p className="text-xs text-slate-500">{context.tenant.name}</p>
          </div>
          <form action={signOutAction}>
            <SubmitButton className="text-sm text-slate-600 underline">Sign out</SubmitButton>
          </form>
        </div>
        <nav className="mx-auto flex max-w-4xl flex-wrap gap-1 px-4 pb-2">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-1.5 text-sm text-slate-700 no-underline hover:bg-slate-100"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
    </div>
  );
}
