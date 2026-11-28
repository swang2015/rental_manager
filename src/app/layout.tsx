import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'RentEase',
  description: 'Multi-tenant rental management for landlords, managers, and tenants.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
