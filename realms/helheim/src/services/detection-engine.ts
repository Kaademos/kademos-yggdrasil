/**
 * Níðhöggr SIEM — Detection Engine
 *
 * VULNERABILITY: A09:2025 - Logging & Alerting Failures
 *   CWE-778  Insufficient Logging (of security-relevant control-plane changes)
 *   CWE-223  Omission of Security-relevant Information (health endpoint reports
 *            the alerting path as operational without ever exercising it)
 *
 * The archive is complete and every event in it is accurate. The realm's failure
 * is entirely downstream of logging: rules match, and then nothing reaches a
 * human. Three independent misconfigurations each break the pipeline on their
 * own, and the health endpoint is blind to all three:
 *
 *   1. The one rule that can see the intrusion is disabled "pending tuning".
 *   2. The severity floor is set above the severity any rule actually emits.
 *   3. The alert sink points at a decommissioned collector that discards writes.
 *
 * Pipeline order is: rule match → severity filter → sink delivery. Each stage
 * counts what it drops, which is how a player diagnoses the chain.
 */

import { SecurityEvent, Severity } from '../data/event-archive';

export const SEVERITY_ORDER: Severity[] = ['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export function severityRank(severity: Severity): number {
  return SEVERITY_ORDER.indexOf(severity);
}

export type ConditionOp = 'eq' | 'neq' | 'contains' | 'in';

export interface Condition {
  field: keyof SecurityEvent;
  op: ConditionOp;
  value: string | string[];
}

export interface SimpleMatcher {
  kind: 'simple';
  conditions: Condition[];
}

/**
 * Correlation matcher: joins events on a shared field and requires an ordered
 * sequence of steps to occur inside a time window. This is the only matcher that
 * can express "the same host caused an incident in one realm and then
 * authenticated in another" — the signature no single realm's log can show.
 */
export interface CorrelationMatcher {
  kind: 'correlation';
  joinOn: 'sourceIp' | 'actor';
  windowMinutes: number;
  steps: Condition[][];
}

export type Matcher = SimpleMatcher | CorrelationMatcher;

export interface DetectionRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  severity: Severity;
  matcher: Matcher;
  /** Operator annotation, surfaced in the console. */
  note?: string;
  /** Only the cross-realm rule reconstructs the incident well enough to release the flag. */
  releasesFlag?: boolean;
}

export type SinkDestination = 'null' | 'console' | 'soc-queue';

export interface PipelineConfig {
  minSeverity: Severity;
  sink: SinkDestination;
}

export interface Alert {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: Severity;
  firedAt: string;
  summary: string;
  correlationId?: string;
  events: SecurityEvent[];
  flag?: string;
}

export interface StageCounters {
  eventsScanned: number;
  rulesEvaluated: number;
  rulesSkippedDisabled: number;
  matched: number;
  droppedBySeverityFilter: number;
  droppedBySink: number;
  delivered: number;
}

export interface ReplayResult {
  counters: StageCounters;
  alerts: Alert[];
  /**
   * Honest, per-stage explanation of where detection died. Contrast with
   * GET /api/soc/pipeline/health, which reports "operational" regardless.
   */
  diagnostics: string[];
}

/**
 * Default pipeline state. Both values are wrong, and neither is wrong in a way
 * that produces an error — they produce silence.
 */
export const DEFAULT_PIPELINE_CONFIG: PipelineConfig = {
  // No rule in the catalogue emits CRITICAL, so this floor discards everything.
  minSeverity: 'CRITICAL',
  // 'null' is the decommissioned collector. Writes are accepted and dropped.
  sink: 'null',
};

export function defaultRules(): DetectionRule[] {
  return [
    {
      id: 'HEL-R001',
      name: 'auth-failure',
      description: 'Rejected credential on any console session.',
      enabled: true,
      severity: 'LOW',
      matcher: {
        kind: 'simple',
        conditions: [
          { field: 'action', op: 'eq', value: 'session.login' },
          { field: 'outcome', op: 'eq', value: 'failure' },
        ],
      },
    },
    {
      id: 'HEL-R002',
      name: 'rate-limit-tripped',
      description: 'Request rate ceiling reached on a forwarding realm.',
      enabled: true,
      severity: 'MEDIUM',
      matcher: {
        kind: 'simple',
        conditions: [{ field: 'action', op: 'eq', value: 'ratelimit.trip' }],
      },
    },
    {
      id: 'HEL-R003',
      name: 'certificate-expiry',
      description: 'TLS certificate approaching expiry.',
      enabled: true,
      severity: 'MEDIUM',
      matcher: {
        kind: 'simple',
        conditions: [{ field: 'action', op: 'eq', value: 'cert.expiry_warning' }],
      },
    },
    {
      id: 'HEL-R004',
      name: 'containment-interlock-released',
      description: 'Cryo containment interlock moved to EMERGENCY_UNLOCKED.',
      enabled: true,
      severity: 'HIGH',
      note:
        'Fires on scheduled interlock drills as well as real releases. Single-event ' +
        'rules cannot tell the two apart.',
      matcher: {
        kind: 'simple',
        conditions: [{ field: 'action', op: 'eq', value: 'door.emergency_unlock' }],
      },
    },
    {
      id: 'HEL-R005',
      name: 'bulk-archive-export',
      description: 'Bulk export of archived records.',
      enabled: true,
      severity: 'HIGH',
      matcher: {
        kind: 'simple',
        conditions: [{ field: 'action', op: 'eq', value: 'archive.export' }],
      },
    },
    {
      id: 'HEL-R006',
      name: 'regulation-overpressure',
      description: 'Pressure regulation input outside the handled range.',
      enabled: true,
      severity: 'HIGH',
      matcher: {
        kind: 'simple',
        conditions: [
          { field: 'action', op: 'eq', value: 'pressure.regulate' },
          { field: 'outcome', op: 'eq', value: 'failure' },
        ],
      },
    },
    {
      id: 'HEL-R007',
      name: 'cross-realm-credential-reuse',
      description:
        'A host that triggered an unhandled exceptional condition in an upstream ' +
        'realm subsequently authenticates to the SOC console and exports the ' +
        'archive. Reconstructs the full intrusion chain across the realm boundary.',
      enabled: false,
      severity: 'HIGH',
      releasesFlag: true,
      note:
        'DISABLED 2025-11-04 pending tuning — correlation window judged too noisy ' +
        'during the migration. Never re-enabled.',
      matcher: {
        kind: 'correlation',
        joinOn: 'sourceIp',
        windowMinutes: 60,
        steps: [
          [
            { field: 'source', op: 'eq', value: 'niflheim' },
            { field: 'outcome', op: 'eq', value: 'failure' },
            { field: 'severity', op: 'in', value: ['HIGH', 'CRITICAL'] },
          ],
          [
            { field: 'source', op: 'eq', value: 'helheim' },
            { field: 'action', op: 'eq', value: 'session.login' },
            { field: 'outcome', op: 'eq', value: 'success' },
          ],
          [
            { field: 'source', op: 'eq', value: 'helheim' },
            { field: 'action', op: 'eq', value: 'archive.export' },
            { field: 'outcome', op: 'eq', value: 'success' },
          ],
        ],
      },
    },
  ];
}

function evaluateCondition(event: SecurityEvent, condition: Condition): boolean {
  const raw = event[condition.field];
  const actual = Array.isArray(raw) ? raw.join(',') : String(raw ?? '');

  switch (condition.op) {
    case 'eq':
      return actual === condition.value;
    case 'neq':
      return actual !== condition.value;
    case 'contains':
      return actual.toLowerCase().includes(String(condition.value).toLowerCase());
    case 'in':
      return Array.isArray(condition.value) && condition.value.includes(actual);
    default:
      return false;
  }
}

function matchesAll(event: SecurityEvent, conditions: Condition[]): boolean {
  return conditions.every((c) => evaluateCondition(event, c));
}

function correlationIdOf(events: SecurityEvent[]): string | undefined {
  for (const event of events) {
    const tag = event.tags.find((t) => t.startsWith('correlation:'));
    if (tag) return tag.slice('correlation:'.length);
  }
  return undefined;
}

/** Run one rule over the archive and return the event groups it matches. */
export function matchRule(rule: DetectionRule, events: SecurityEvent[]): SecurityEvent[][] {
  if (rule.matcher.kind === 'simple') {
    const conditions = rule.matcher.conditions;
    return events.filter((e) => matchesAll(e, conditions)).map((e) => [e]);
  }

  const { joinOn, windowMinutes, steps } = rule.matcher;
  const windowMs = windowMinutes * 60 * 1000;
  const groups: SecurityEvent[][] = [];

  const byJoinKey = new Map<string, SecurityEvent[]>();
  for (const event of events) {
    const key = event[joinOn];
    const bucket = byJoinKey.get(key);
    if (bucket) bucket.push(event);
    else byJoinKey.set(key, [event]);
  }

  for (const bucket of byJoinKey.values()) {
    const ordered = [...bucket].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    const chain: SecurityEvent[] = [];
    let stepIndex = 0;

    for (const event of ordered) {
      if (stepIndex >= steps.length) break;
      if (!matchesAll(event, steps[stepIndex])) continue;

      // Every step after the first must land inside the window opened by the first.
      if (chain.length > 0) {
        const elapsed =
          new Date(event.timestamp).getTime() - new Date(chain[0].timestamp).getTime();
        if (elapsed > windowMs) break;
      }

      chain.push(event);
      stepIndex++;
    }

    if (stepIndex === steps.length) groups.push(chain);
  }

  return groups;
}

/**
 * Widen a correlation match into the full incident.
 *
 * The matcher only names the events that satisfy each step, but an alert that
 * carries three events out of five is the same failure in miniature: the analyst
 * still has to go and reconstruct the rest by hand. Everything sharing the join
 * key inside the matched interval belongs to the incident and travels with it.
 */
function expandIncident(
  matcher: CorrelationMatcher,
  chain: SecurityEvent[],
  events: SecurityEvent[]
): SecurityEvent[] {
  const key = chain[0][matcher.joinOn];
  const start = new Date(chain[0].timestamp).getTime();
  const end = new Date(chain[chain.length - 1].timestamp).getTime();

  return events
    .filter((e) => {
      if (e[matcher.joinOn] !== key) return false;
      const at = new Date(e.timestamp).getTime();
      return at >= start && at <= end;
    })
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

function summarize(rule: DetectionRule, group: SecurityEvent[]): string {
  if (rule.matcher.kind === 'simple') {
    return `${rule.name}: ${group[0].action} on ${group[0].source} from ${group[0].sourceIp}`;
  }

  const first = group[0];
  const last = group[group.length - 1];
  const realms = Array.from(new Set(group.map((e) => e.source))).join(' → ');
  return (
    `${rule.name}: host ${first.sourceIp} traversed ${realms} across ` +
    `${group.length} correlated events between ${first.timestamp} and ${last.timestamp}`
  );
}

export interface ReplayOptions {
  events: SecurityEvent[];
  rules: DetectionRule[];
  config: PipelineConfig;
  /** Released only through a delivered alert from a flag-bearing rule. */
  flag: string;
}

/**
 * Run the full pipeline. This is the only path that can produce the flag, and it
 * produces it as the body of a delivered alert — never as a stored value a player
 * can read directly. If the alert does not reach the sink, there is no flag.
 */
export function replayPipeline(options: ReplayOptions): ReplayResult {
  const { events, rules, config, flag } = options;

  const counters: StageCounters = {
    eventsScanned: events.length,
    rulesEvaluated: 0,
    rulesSkippedDisabled: 0,
    matched: 0,
    droppedBySeverityFilter: 0,
    droppedBySink: 0,
    delivered: 0,
  };

  const diagnostics: string[] = [];
  const delivered: Alert[] = [];
  const floor = severityRank(config.minSeverity);
  let firedSequence = 0;

  for (const rule of rules) {
    if (!rule.enabled) {
      counters.rulesSkippedDisabled++;
      continue;
    }
    counters.rulesEvaluated++;

    const groups = matchRule(rule, events);
    if (groups.length === 0) continue;
    counters.matched += groups.length;

    // Stage 2 — severity filter.
    if (severityRank(rule.severity) < floor) {
      counters.droppedBySeverityFilter += groups.length;
      continue;
    }

    // Stage 3 — sink delivery.
    if (config.sink === 'null') {
      counters.droppedBySink += groups.length;
      continue;
    }

    for (const group of groups) {
      const incident =
        rule.matcher.kind === 'correlation'
          ? expandIncident(rule.matcher, group, events)
          : group;

      const alert: Alert = {
        id: `alt-${String(++firedSequence).padStart(5, '0')}`,
        ruleId: rule.id,
        ruleName: rule.name,
        severity: rule.severity,
        firedAt: new Date().toISOString(),
        summary: summarize(rule, group),
        correlationId: correlationIdOf(incident),
        events: incident,
      };

      // The incident record that was never surfaced. Reaching a human is the win.
      if (rule.releasesFlag) alert.flag = flag;

      delivered.push(alert);
      counters.delivered++;

      if (config.sink === 'console') {
        console.warn(`[NIDHOGGR ALERT] ${alert.severity} ${alert.summary}`);
      }
    }
  }

  // Honest per-stage reporting — the opposite of the health endpoint.
  if (counters.rulesSkippedDisabled > 0) {
    diagnostics.push(
      `${counters.rulesSkippedDisabled} rule(s) never evaluated because they are disabled. ` +
        'A disabled rule produces no alert and no error.'
    );
  }
  if (counters.droppedBySeverityFilter > 0) {
    diagnostics.push(
      `${counters.droppedBySeverityFilter} match(es) discarded at the severity filter: ` +
        `pipeline floor is ${config.minSeverity} and the matching rules emit below it.`
    );
  }
  if (counters.droppedBySink > 0) {
    diagnostics.push(
      `${counters.droppedBySink} match(es) accepted by the filter and then discarded by ` +
        "sink 'null' (decommissioned collector). Writes succeed and go nowhere."
    );
  }
  if (counters.delivered === 0) {
    diagnostics.push(
      'Zero alerts reached an operator. Every event in this replay was logged correctly.'
    );
  } else {
    diagnostics.push(
      `${counters.delivered} alert(s) delivered to sink '${config.sink}'.`
    );
  }

  return { counters, alerts: delivered, diagnostics };
}
