function fmt(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    'Z'
  );
}

function escape(s: string): string {
  return s.replace(/[\\;,]/g, (c) => '\\' + c).replace(/\n/g, '\\n');
}

export interface IcsInput {
  uid: string;
  start: Date;
  durationMinutes: number;
  title: string;
  description?: string | undefined;
  url?: string | undefined;
  organizer?: { name: string; email: string } | undefined;
}

export function buildIcs(input: IcsInput): string {
  const end = new Date(input.start.getTime() + input.durationMinutes * 60_000);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//LearnWithLeaders//FDF//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${input.uid}`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(input.start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${escape(input.title)}`,
  ];
  if (input.description) lines.push(`DESCRIPTION:${escape(input.description)}`);
  if (input.url) lines.push(`URL:${input.url}`);
  if (input.organizer)
    lines.push(`ORGANIZER;CN=${escape(input.organizer.name)}:mailto:${input.organizer.email}`);
  lines.push('STATUS:CONFIRMED', 'END:VEVENT', 'END:VCALENDAR');
  return lines.join('\r\n');
}
