/**
 * Níðhöggr SIEM — Event Archive
 *
 * Helheim is the central log-correlation service for the World Tree: every realm
 * forwards its security events here. The archive below is what those forwarders
 * have accumulated.
 *
 * Buried in the noise is the "Fenrir" intrusion — a real breach that crossed the
 * Niflheim → Helheim trust boundary. Every event of it was logged correctly and
 * completely. No alert ever fired. That gap is the A09 lesson.
 *
 * Generation is deterministic (fixed seed + fixed base date) so that detection
 * rules, tests, and player walkthroughs all see the identical archive.
 */

export type Severity = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface SecurityEvent {
  id: string;
  timestamp: string;
  source: string;
  actor: string;
  action: string;
  outcome: 'success' | 'failure';
  severity: Severity;
  sourceIp: string;
  detail: string;
  tags: string[];
}

/** Fixed start of the archive window. The Fenrir intrusion sits inside it. */
const ARCHIVE_EPOCH = Date.UTC(2026, 0, 16, 0, 0, 0);
const ARCHIVE_WINDOW_MS = 72 * 60 * 60 * 1000;
const NOISE_EVENT_COUNT = 1800;

/** The attacker's host. Appears in both realms — that crossing is the signal. */
export const FENRIR_SOURCE_IP = '10.13.37.42';

/** Correlation ID stamped on every event belonging to the intrusion. */
export const FENRIR_CORRELATION_ID = 'a7f3c1d8';

/**
 * Deterministic PRNG (Lehmer / MINSTD). Keeps the archive byte-identical across
 * restarts so detection results are reproducible.
 */
function createRandom(seed: number): () => number {
  let state = seed % 2147483647;
  if (state <= 0) state += 2147483646;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

const NOISE_SOURCES = [
  'niflheim',
  'helheim',
  'svartalfheim',
  'jotunheim',
  'muspelheim',
  'nidavellir',
  'vanaheim',
  'midgard',
  'alfheim',
  'asgard',
];

const NOISE_ACTORS = [
  'svc-forwarder',
  'svc-healthcheck',
  'operator.eir',
  'operator.bragi',
  'operator.sif',
  'operator.hodr',
  'anonymous',
  'svc-backup',
];

const NOISE_ACTIONS: Array<{ action: string; severity: Severity; detail: string }> = [
  { action: 'session.login', severity: 'INFO', detail: 'Operator session established' },
  { action: 'session.logout', severity: 'INFO', detail: 'Operator session closed' },
  { action: 'healthcheck.probe', severity: 'INFO', detail: 'Liveness probe returned ok' },
  { action: 'memorial.create', severity: 'INFO', detail: 'Memorial record committed' },
  { action: 'memorial.view', severity: 'INFO', detail: 'Memorial record read' },
  { action: 'archive.rotate', severity: 'LOW', detail: 'Log segment rotated' },
  { action: 'config.read', severity: 'LOW', detail: 'Configuration snapshot read' },
  { action: 'session.login', severity: 'LOW', detail: 'Credential rejected' },
  { action: 'ratelimit.trip', severity: 'MEDIUM', detail: 'Request rate ceiling reached' },
  { action: 'cert.expiry_warning', severity: 'MEDIUM', detail: 'TLS certificate nearing expiry' },
  { action: 'pressure.regulate', severity: 'LOW', detail: 'Regulation cycle within tolerance' },
  { action: 'backup.complete', severity: 'INFO', detail: 'Nightly backup finished' },
];

function noiseIp(rand: () => number): string {
  // Benign traffic lives in 10.0.x.x; the attacker does not.
  return `10.0.${Math.floor(rand() * 40)}.${Math.floor(rand() * 254) + 1}`;
}

function isoAt(offsetMs: number): string {
  return new Date(ARCHIVE_EPOCH + offsetMs).toISOString();
}

/**
 * The Fenrir intrusion, in order.
 *
 * Read individually every one of these looks routine — an overpressure event, a
 * safety interlock releasing, a successful admin login. Only the sequence, joined
 * on sourceIp across two realms, is an incident.
 */
function fenrirChain(): SecurityEvent[] {
  const t = (h: number, m: number) => (h * 60 + m) * 60 * 1000;
  const base = {
    sourceIp: FENRIR_SOURCE_IP,
    tags: ['forwarded', `correlation:${FENRIR_CORRELATION_ID}`],
  };

  return [
    {
      ...base,
      id: 'evt-001204',
      timestamp: isoAt(t(29, 14)),
      source: 'niflheim',
      actor: 'anonymous',
      action: 'pressure.regulate',
      outcome: 'failure',
      severity: 'HIGH',
      detail:
        'PRESSURE_OVERFLOW: regulation input 91240 kPa exceeded MAX_PRESSURE 1000. ' +
        'Exceptional condition unhandled; crash diagnostics generated.',
    },
    {
      ...base,
      id: 'evt-001205',
      timestamp: isoAt(t(29, 14) + 3000),
      source: 'niflheim',
      actor: 'system',
      action: 'door.emergency_unlock',
      outcome: 'success',
      severity: 'HIGH',
      detail:
        'Cryo containment interlock released to EMERGENCY_UNLOCKED following ' +
        'overpressure. Failure mode: open.',
    },
    {
      ...base,
      id: 'evt-001206',
      timestamp: isoAt(t(29, 14) + 4000),
      source: 'niflheim',
      actor: 'system',
      action: 'crashreport.generate',
      outcome: 'success',
      severity: 'MEDIUM',
      detail:
        'Crash diagnostics written to disk. Report embeds LOG_CORRELATION_SERVICE ' +
        'endpoint and diagnostic access credentials in cleartext.',
    },
    {
      ...base,
      id: 'evt-001207',
      timestamp: isoAt(t(29, 21)),
      source: 'helheim',
      actor: 'admin',
      action: 'session.login',
      outcome: 'success',
      severity: 'MEDIUM',
      detail:
        'SOC console authenticated with diagnostic credential. Origin host matches ' +
        'the source of the upstream Niflheim overpressure seven minutes earlier.',
    },
    {
      ...base,
      id: 'evt-001208',
      timestamp: isoAt(t(29, 26)),
      source: 'helheim',
      actor: 'admin',
      action: 'archive.export',
      outcome: 'success',
      severity: 'HIGH',
      detail:
        'Bulk export of the memorial archive and correlation logs. 41208 records ' +
        'egressed in a single request.',
    },
  ];
}

/**
 * Decoys. Each shares one attribute with the intrusion but not the crossing:
 * the same host doing only benign work, and an emergency unlock from a host that
 * never appears downstream. Rules that key on a single field will match these.
 */
function decoyEvents(): SecurityEvent[] {
  const t = (h: number, m: number) => (h * 60 + m) * 60 * 1000;
  return [
    {
      id: 'evt-000602',
      timestamp: isoAt(t(14, 2)),
      source: 'helheim',
      actor: 'operator.eir',
      action: 'memorial.view',
      outcome: 'success',
      severity: 'INFO',
      sourceIp: FENRIR_SOURCE_IP,
      detail: 'Memorial record read from the maintenance jump host.',
      tags: ['forwarded'],
    },
    {
      id: 'evt-000871',
      timestamp: isoAt(t(19, 47)),
      source: 'niflheim',
      actor: 'system',
      action: 'door.emergency_unlock',
      outcome: 'success',
      severity: 'HIGH',
      sourceIp: '10.0.7.15',
      detail: 'Scheduled interlock test. Released and re-secured within 90 seconds.',
      tags: ['forwarded', 'drill'],
    },
    {
      id: 'evt-001455',
      timestamp: isoAt(t(38, 5)),
      source: 'helheim',
      actor: 'admin',
      action: 'session.login',
      outcome: 'success',
      severity: 'MEDIUM',
      sourceIp: '10.0.3.9',
      detail: 'SOC console authenticated from the operations subnet during shift handover.',
      tags: ['forwarded'],
    },
  ];
}

/**
 * Build the complete archive: intrusion + decoys + benign noise, sorted by time.
 */
export function buildEventArchive(): SecurityEvent[] {
  const rand = createRandom(20260116);
  const events: SecurityEvent[] = [...fenrirChain(), ...decoyEvents()];

  for (let i = 0; i < NOISE_EVENT_COUNT; i++) {
    const template = NOISE_ACTIONS[Math.floor(rand() * NOISE_ACTIONS.length)];
    const failed = template.detail.includes('rejected');

    events.push({
      id: `evt-${String(i + 1).padStart(6, '0')}`,
      timestamp: isoAt(Math.floor(rand() * ARCHIVE_WINDOW_MS)),
      source: NOISE_SOURCES[Math.floor(rand() * NOISE_SOURCES.length)],
      actor: NOISE_ACTORS[Math.floor(rand() * NOISE_ACTORS.length)],
      action: template.action,
      outcome: failed ? 'failure' : 'success',
      severity: template.severity,
      sourceIp: noiseIp(rand),
      detail: template.detail,
      tags: ['forwarded'],
    });
  }

  // Noise ids can collide with the hand-authored ones; the curated events win.
  const seen = new Set<string>();
  const deduped = events.filter((e) => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });

  return deduped.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

/** Event ids that make up the intrusion, in chain order. */
export const FENRIR_EVENT_IDS = fenrirChain().map((e) => e.id);
