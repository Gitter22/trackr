/** Today's calendar date in an IANA timezone, as UTC midnight (how @db.Date values are stored). */
export function todayInTimezone(timezone: string, now = new Date()): Date {
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  return new Date(`${ymd}T00:00:00.000Z`);
}
