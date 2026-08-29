export function monthLabel(dateString: string) {
  const d = new Date(`${dateString}T12:00:00`);
  return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }).replace(/^./, c => c.toUpperCase());
}
export function nextMonthStart(monthStart: string) {
  const d = new Date(`${monthStart}T12:00:00`); d.setMonth(d.getMonth()+1,1); return d.toISOString().slice(0,10);
}
export function monthEnd(monthStart: string) {
  const d = new Date(`${nextMonthStart(monthStart)}T12:00:00`); d.setDate(d.getDate()-1); return d.toISOString().slice(0,10);
}
export function daysInPeriodRemaining(monthStart: string) {
  const start = new Date(`${monthStart}T12:00:00`);
  const end = new Date(`${monthEnd(monthStart)}T12:00:00`);
  const today = new Date(); today.setHours(12,0,0,0);
  if (today < start) return Math.round((end.getTime()-start.getTime())/86400000)+1;
  if (today > end) return 0;
  return Math.round((end.getTime()-today.getTime())/86400000)+1;
}
export function formatDate(date?: string | null) {
  if (!date) return '—';
  return new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'});
}
export function daysUntil(date?: string | null) {
  if (!date) return null;
  const d=new Date(`${date}T12:00:00`); const t=new Date(); t.setHours(12,0,0,0); return Math.ceil((d.getTime()-t.getTime())/86400000);
}
export function isoDate(d: Date) { return d.toISOString().slice(0,10); }
