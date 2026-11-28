'use server';

import type { PaymentMethod } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { requireManager } from '@/lib/auth/session';
import { ensureChargesForPeriod, recordAdjustment, recordPayment } from '@/lib/domain/billing';
import { monthKey } from '@/lib/domain/dates';
import { fail, formDate, formMoneyCents, formValue, succeed } from '@/lib/actions/helpers';

function periodFromForm(form: FormData) {
  const key =
    formValue(form, 'month') || monthKey(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1);
  const [year, month] = key.split('-').map(Number);
  return { year, month, key };
}

export async function ensureChargesAction(form: FormData): Promise<void> {
  const { db, ownerUserId } = await requireManager();
  const period = periodFromForm(form);
  let created = 0;
  try {
    created = await ensureChargesForPeriod(db, ownerUserId, period);
  } catch (error) {
    fail('/rent', error, { month: period.key });
  }
  revalidatePath('/rent');
  succeed(`/rent?month=${period.key}`, `Charge generation finished: ${created} new charge(s).`);
}

export async function recordPaymentAction(form: FormData): Promise<void> {
  const { db, ownerUserId, user } = await requireManager();
  const chargeId = formValue(form, 'chargeId');
  const month = formValue(form, 'month');
  try {
    await recordPayment(db, ownerUserId, chargeId, {
      amountCents: formMoneyCents(form, 'amount'),
      paidOn: formDate(form, 'paidOn'),
      method: formValue(form, 'method') as PaymentMethod,
      reference: formValue(form, 'reference') || null,
      recordedByUserId: user.id,
    });
  } catch (error) {
    fail(`/rent/${chargeId}`, error, { month });
  }
  revalidatePath('/rent');
  revalidatePath(`/rent/${chargeId}`);
  succeed(`/rent/${chargeId}?month=${month}`, 'Payment recorded.');
}

export async function recordAdjustmentAction(form: FormData): Promise<void> {
  const { db, ownerUserId, user } = await requireManager();
  const chargeId = formValue(form, 'chargeId');
  const month = formValue(form, 'month');
  try {
    await recordAdjustment(db, ownerUserId, chargeId, {
      amountCents: formMoneyCents(form, 'amount'),
      reason: formValue(form, 'reason'),
      createdByUserId: user.id,
    });
  } catch (error) {
    fail(`/rent/${chargeId}`, error, { month });
  }
  revalidatePath('/rent');
  revalidatePath(`/rent/${chargeId}`);
  succeed(`/rent/${chargeId}?month=${month}`, 'Adjustment recorded.');
}
