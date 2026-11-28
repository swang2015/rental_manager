import Link from 'next/link';
import { requireSuperAdmin } from '@/lib/auth/session';
import { signOutAction } from '../session-actions';
import { SubmitButton } from '@/components/submit-button';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSuperAdmin();

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-sm font-semibold">RentEase · Platform admin</p>
            <p className="text-xs text-slate-500">
              {user.name} · {user.email}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-sm text-slate-700 no-underline hover:underline">
              Organizations
            </Link>
            <form action={signOutAction}>
              <SubmitButton className="text-sm text-slate-600 underline">Sign out</SubmitButton>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
