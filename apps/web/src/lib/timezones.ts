/** IANA timezones known to this browser (UTC first). */
export function timezones(): string[] {
  const all = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];
  return ['UTC', ...all.filter((tz) => tz !== 'UTC')];
}

export const browserTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
