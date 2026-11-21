export function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export const UNIT_STATUS_LABEL: Record<string, string> = {
  AVAILABLE: 'Available',
  OCCUPIED: 'Occupied',
  OFF_MARKET: 'Off-market',
};

export const LEASE_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft',
  ACTIVE: 'Active',
  ENDED: 'Ended',
};

export const CHARGE_STATUS_LABEL: Record<string, string> = {
  unpaid: 'Unpaid',
  partial: 'Partial',
  paid: 'Paid',
  overdue: 'Overdue',
};

export const REQUEST_STATUS_LABEL: Record<string, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In progress',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
  CANCELLED: 'Cancelled',
};

export const WORK_ORDER_STATUS_LABEL: Record<string, string> = {
  SCHEDULED: 'Scheduled',
  IN_PROGRESS: 'In progress',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

export const PRIORITY_LABEL: Record<string, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  URGENT: 'Urgent',
};

export const ROLE_LABEL: Record<string, string> = {
  OWNER: 'Owner',
  PROPERTY_MANAGER: 'Property manager',
  STAFF: 'Staff',
};

type Tone = 'gray' | 'green' | 'amber' | 'red' | 'blue';

export function unitStatusTone(status: string): Tone {
  if (status === 'OCCUPIED') return 'green';
  if (status === 'AVAILABLE') return 'blue';
  return 'gray';
}

export function leaseStatusTone(status: string): Tone {
  if (status === 'ACTIVE') return 'green';
  if (status === 'DRAFT') return 'amber';
  return 'gray';
}

export function chargeStatusTone(status: string): Tone {
  if (status === 'paid') return 'green';
  if (status === 'partial') return 'amber';
  if (status === 'overdue') return 'red';
  return 'gray';
}

export function requestStatusTone(status: string): Tone {
  if (status === 'OPEN') return 'amber';
  if (status === 'IN_PROGRESS') return 'blue';
  if (status === 'RESOLVED') return 'green';
  if (status === 'CLOSED') return 'gray';
  return 'red';
}

export function priorityTone(priority: string): Tone {
  if (priority === 'URGENT') return 'red';
  if (priority === 'MEDIUM') return 'amber';
  return 'gray';
}

export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function dateToInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}
