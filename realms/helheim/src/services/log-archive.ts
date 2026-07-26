/**
 * Níðhöggr SIEM — On-disk Log Archive
 *
 * Materialises the flat log files the SOC console exposes. `niflheim_correlation.log`
 * is the artefact Niflheim's crash report tells the player to review; it is written
 * here at boot so the Niflheim → Helheim chain resolves to a real file.
 *
 * These files are the *logging* half of A09 done correctly: complete, accurate,
 * scoped, and with the flag redacted. Reading them tells the player what happened.
 * It does not tell anyone that it happened — that requires the alert pipeline.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  buildEventArchive,
  FENRIR_CORRELATION_ID,
  FENRIR_SOURCE_IP,
  SecurityEvent,
} from '../data/event-archive';

/** Files the log viewer will serve. Nothing outside this set is readable. */
export const ARCHIVE_FILES = [
  'app.log',
  'error.log',
  'memorial.log',
  'niflheim_correlation.log',
] as const;

export type ArchiveFileName = (typeof ARCHIVE_FILES)[number];

export function archiveDir(): string {
  return path.join(__dirname, '../../logs');
}

function syslogLine(event: SecurityEvent): string {
  return (
    `${event.timestamp} ${event.source.padEnd(13)} ${event.severity.padEnd(8)} ` +
    `${event.action.padEnd(28)} outcome=${event.outcome.padEnd(7)} ` +
    `actor=${event.actor} src=${event.sourceIp} :: ${event.detail}`
  );
}

function correlationLog(events: SecurityEvent[]): string {
  const chain = events
    .filter((e) => e.tags.includes(`correlation:${FENRIR_CORRELATION_ID}`))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  const header = [
    '='.repeat(96),
    'NIFLHEIM CORRELATION LOG',
    `Correlation ID : ${FENRIR_CORRELATION_ID}`,
    `Origin host    : ${FENRIR_SOURCE_IP}`,
    `Forwarder      : niflheim → helheim (central log correlation service)`,
    `Records        : ${chain.length}`,
    '',
    'Every record below was received, parsed, and stored successfully.',
    'Alert pipeline disposition for this correlation ID: NO ALERT GENERATED.',
    '='.repeat(96),
    '',
  ].join('\n');

  const body = chain
    .map((e, i) => `[${String(i + 1).padStart(2, '0')}] ${syslogLine(e)}`)
    .join('\n');

  const footer = [
    '',
    '-'.repeat(96),
    'ANALYST NOTE (unactioned)',
    '',
    '  These records span two realms. No single realm log contains the whole chain,',
    '  which is why the correlation service exists. The service ingested all of it',
    '  and raised nothing.',
    '',
    '  The rule that would have caught this pattern is in the catalogue. Review the',
    '  detection rules and the alert pipeline configuration on the SOC console:',
    '',
    '      GET  /api/soc/rules',
    '      GET  /api/soc/pipeline/config',
    '      POST /api/soc/pipeline/replay',
    '',
    '  Incident records are released with the alert, not from this archive.',
    '-'.repeat(96),
    '',
  ].join('\n');

  return `${header}${body}\n${footer}`;
}

function appLog(events: SecurityEvent[]): string {
  const lines = events
    .filter((e) => e.severity === 'INFO' || e.severity === 'LOW')
    .slice(0, 400)
    .map(syslogLine);

  return (
    `# Helheim application log — ${lines.length} records\n` +
    '# Retention 30d. Flag values are redacted by the log sanitiser.\n\n' +
    lines.join('\n') +
    '\n'
  );
}

function errorLog(events: SecurityEvent[]): string {
  const lines = events
    .filter((e) => e.outcome === 'failure')
    .slice(0, 200)
    .map(syslogLine);

  return (
    '# Helheim error log\n' +
    '#\n' +
    '# NOTE: this file previously embedded realm flags and full request headers in\n' +
    '# every stack trace. The sanitiser now redacts secrets before write. Complete\n' +
    '# logging without alerting still detects nothing — see niflheim_correlation.log.\n' +
    '#\n' +
    `# Records: ${lines.length}\n\n` +
    lines.join('\n') +
    '\n'
  );
}

function memorialLog(events: SecurityEvent[]): string {
  const lines = events
    .filter((e) => e.action.startsWith('memorial.'))
    .slice(0, 300)
    .map(syslogLine);

  return `# Helheim memorial forum log — ${lines.length} records\n\n` + lines.join('\n') + '\n';
}

/**
 * Write every archive file to disk. Idempotent: safe to call on each boot.
 */
export function seedLogArchive(): string {
  const dir = archiveDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const events = buildEventArchive();
  const contents: Record<ArchiveFileName, string> = {
    'app.log': appLog(events),
    'error.log': errorLog(events),
    'memorial.log': memorialLog(events),
    'niflheim_correlation.log': correlationLog(events),
  };

  for (const name of ARCHIVE_FILES) {
    fs.writeFileSync(path.join(dir, name), contents[name], 'utf-8');
  }

  return dir;
}

/**
 * Read one archive file by name.
 *
 * The viewer resolves against a fixed allow-list rather than joining user input
 * onto a base path, so `../` and absolute paths are not expressible. The A09
 * failure in this realm is that privileged reads here are never alerted on — not
 * that the reader can be walked out of its directory.
 */
export function readArchiveFile(name: string): string | null {
  if (!ARCHIVE_FILES.includes(name as ArchiveFileName)) {
    return null;
  }

  const filePath = path.join(archiveDir(), name);
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return fs.readFileSync(filePath, 'utf-8');
}
