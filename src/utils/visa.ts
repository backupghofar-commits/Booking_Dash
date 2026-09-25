import { Booking, VisaAction } from '../types/booking';

export const VISA_ACTIONS: VisaAction[] = ['Agreement Sent', 'Approved', 'Rejected', 'BRN'];

export const visaActionStyle: Record<VisaAction, string> = {
  'Agreement Sent': 'bg-sky-50 text-sky-800 border-sky-400 dark:bg-sky-950 dark:text-sky-300',
  Approved: 'bg-emerald-50 text-emerald-800 border-emerald-400 dark:bg-emerald-950 dark:text-emerald-300',
  Rejected: 'bg-rose-50 text-rose-800 border-rose-400 dark:bg-rose-950 dark:text-rose-300',
  BRN: 'bg-amber-50 text-amber-800 border-amber-400 dark:bg-amber-950 dark:text-amber-300',
};

/** Days from today (midnight) to a given ISO date; negative = past */
export const daysUntil = (iso: string): number => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((new Date(`${iso}T00:00:00`).getTime() - today.getTime()) / 86400000);
};

/** H-30 → H-0 phased visa reminder with urgency colour + blink animation */
export const visaReminder = (b: Booking) => {
  if (b.visaAction === 'Approved')
    return { txt: 'Approved ✓', cls: 'bg-emerald-100 text-emerald-800 border-emerald-400 dark:bg-emerald-950 dark:text-emerald-300', anim: '' };
  if (b.visaAction === 'BRN')
    return { txt: 'BRN Issued', cls: 'bg-amber-100 text-amber-800 border-amber-400 dark:bg-amber-950 dark:text-amber-300', anim: '' };
  if (b.visaAction === 'Rejected')
    return { txt: 'Rejected', cls: 'bg-slate-200 text-slate-600 border-slate-400 dark:bg-slate-800 dark:text-slate-400', anim: '' };
  const days = daysUntil(b.checkInDate);
  if (days < 0)
    return { txt: `H+${-days} Passed`, cls: 'bg-slate-100 text-slate-500 border-slate-300 dark:bg-slate-800 dark:text-slate-400', anim: '' };
  if (days === 0)
    return { txt: 'H-0 CHECK-IN!', cls: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-500 dark:bg-fuchsia-950 dark:text-fuchsia-300', anim: 'alarm-critical' };
  if (days <= 7)
    return { txt: `H-${days} CRITICAL`, cls: 'bg-rose-100 text-rose-800 border-rose-500 dark:bg-rose-950 dark:text-rose-300', anim: 'alarm-fast' };
  if (days <= 15)
    return { txt: `H-${days} URGENT`, cls: 'bg-orange-100 text-orange-800 border-orange-500 dark:bg-orange-950 dark:text-orange-300', anim: 'alarm-mid' };
  if (days <= 30)
    return { txt: `H-${days} Apply Visa`, cls: 'bg-amber-100 text-amber-800 border-amber-400 dark:bg-amber-950 dark:text-amber-300', anim: 'alarm-slow' };
  return { txt: `H-${days} On Track`, cls: 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-400', anim: '' };
};
