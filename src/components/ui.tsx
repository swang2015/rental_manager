import Link from 'next/link';
import type { ReactNode } from 'react';

export const inputClass =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200';

export const buttonClass =
  'inline-flex items-center justify-center rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50';

export const secondaryButtonClass =
  'inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100';

const TONES = {
  gray: 'bg-slate-100 text-slate-700',
  green: 'bg-emerald-100 text-emerald-800',
  amber: 'bg-amber-100 text-amber-800',
  red: 'bg-rose-100 text-rose-800',
  blue: 'bg-sky-100 text-sky-800',
} as const;

export function Badge({ tone = 'gray', children }: { tone?: keyof typeof TONES; children: ReactNode }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${TONES[tone]}`}>
      {children}
    </span>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-slate-600">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function Card({
  title,
  actions,
  children,
  className = '',
}: {
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-lg border border-slate-200 bg-white shadow-sm ${className}`}>
      {title || actions ? (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
          {title ? <h2 className="text-sm font-semibold text-slate-800">{title}</h2> : null}
          {actions}
        </header>
      ) : null}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Alert({ error, ok }: { error?: string; ok?: string }) {
  if (!error && !ok) return null;
  return (
    <div className="mb-4 space-y-2">
      {error ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}
      {ok ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {ok}
        </p>
      ) : null}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
  className = '',
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="mb-1 block font-medium text-slate-700">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}

export function Stat({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  href?: string;
}) {
  const inner = (
    <>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </>
  );
  const className =
    'block rounded-lg border border-slate-200 bg-white p-4 shadow-sm no-underline text-slate-900';
  return href ? (
    <Link href={href} className={`${className} hover:border-slate-400`}>
      {inner}
    </Link>
  ) : (
    <div className={className}>{inner}</div>
  );
}

export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
            {head.map((column) => (
              <th key={column} className="px-2 py-2 font-medium">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  );
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-2 py-6 text-center text-sm text-slate-500">
        {children}
      </td>
    </tr>
  );
}

export function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="font-medium text-slate-900 underline decoration-slate-300">
      {children}
    </Link>
  );
}
