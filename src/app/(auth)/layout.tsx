import Link from 'next/link';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-6 block text-center text-lg font-semibold no-underline">
          Rental Manager
        </Link>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">{children}</div>
      </div>
    </div>
  );
}
