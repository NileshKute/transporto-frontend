/** Driver label for selects: "Nickname — Full Name" or nickname-only / name-only. */
export function driverSelectLabel(d: {
  name?: string | null;
  nickname?: string | null;
}): string {
  const name = String(d.name ?? '').trim();
  const nick = String(d.nickname ?? '').trim();
  if (nick && name) return `${nick} — ${name}`;
  if (nick) return nick;
  return name || '—';
}

/** Table / list: "Nickname (Full Name)" or "Nickname" or full name. */
export function driverListLabel(d: {
  name?: string | null;
  nickname?: string | null;
}): string {
  const name = String(d.name ?? '').trim();
  const nick = String(d.nickname ?? '').trim();
  if (nick && name) return `${nick} (${name})`;
  if (nick) return nick;
  return name || '—';
}
