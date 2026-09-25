/**
 * Invoice reference numbering: CL.TMM-(MM)/(YY)-(RANDOM)
 * e.g. CL.TMM-08/26-4821
 */
export const generateInvoiceRef = (d: Date = new Date()): string => {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear() % 100).padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `CL.TMM-${mm}/${yy}-${rand}`;
};
