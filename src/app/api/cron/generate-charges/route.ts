import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { scopedDb } from '@/lib/db/scoped';
import { ensureChargesForPeriod } from '@/lib/domain/billing';

export const dynamic = 'force-dynamic';

function currentPeriod() {
  const now = new Date();
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const month = request.nextUrl.searchParams.get('month');
  let period = currentPeriod();
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [year, value] = month.split('-').map(Number);
    period = { year, month: value };
  }

  const organizations = await prisma.organization.findMany({ select: { id: true, name: true } });
  const results: { organization: string; created: number }[] = [];

  for (const organization of organizations) {
    const created = await ensureChargesForPeriod(scopedDb(organization.id), organization.id, period);
    results.push({ organization: organization.name, created });
  }

  return NextResponse.json({ period, results });
}
