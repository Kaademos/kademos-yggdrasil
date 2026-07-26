/**
 * Níðhöggr SIEM — Runtime State
 *
 * Holds the event archive, the mutable detection-rule catalogue, the alert
 * pipeline configuration, and whatever alerts have actually been delivered.
 *
 * VULNERABILITY (CWE-778, Insufficient Logging): mutations to the detection
 * catalogue and the alert pipeline are security-relevant control-plane changes,
 * and none of them are recorded. `controlPlaneAudit` exists, is exposed at
 * GET /api/soc/audit, and stays empty no matter how many rules are switched off.
 * An attacker who disables detection leaves exactly as much evidence as an
 * attacker who does nothing.
 */

import { buildEventArchive, SecurityEvent, Severity } from '../data/event-archive';
import {
  Alert,
  DEFAULT_PIPELINE_CONFIG,
  DetectionRule,
  PipelineConfig,
  ReplayResult,
  SinkDestination,
  defaultRules,
  replayPipeline,
  SEVERITY_ORDER,
} from './detection-engine';

export interface ControlPlaneAuditEntry {
  timestamp: string;
  actor: string;
  change: string;
}

export interface PipelineHealth {
  status: string;
  ingest: string;
  rules: string;
  alerting: string;
  lastSelfTest: string | null;
  note: string;
}

export const VALID_SINKS: SinkDestination[] = ['null', 'console', 'soc-queue'];

export class SocState {
  private readonly flag: string;
  private events: SecurityEvent[];
  private rules: DetectionRule[];
  private pipeline: PipelineConfig;
  private deliveredAlerts: Alert[] = [];
  private lastReplay: ReplayResult | null = null;

  /**
   * VULNERABLE: never appended to. Present so the omission is observable rather
   * than merely absent.
   */
  private readonly controlPlaneAudit: ControlPlaneAuditEntry[] = [];

  constructor(flag: string) {
    this.flag = flag;
    this.events = buildEventArchive();
    this.rules = defaultRules();
    this.pipeline = { ...DEFAULT_PIPELINE_CONFIG };
  }

  getEvents(): SecurityEvent[] {
    return this.events;
  }

  getRules(): DetectionRule[] {
    return this.rules;
  }

  getRule(id: string): DetectionRule | undefined {
    return this.rules.find((r) => r.id.toLowerCase() === id.toLowerCase());
  }

  getPipelineConfig(): PipelineConfig {
    return { ...this.pipeline };
  }

  getAlerts(): Alert[] {
    return this.deliveredAlerts;
  }

  getLastReplay(): ReplayResult | null {
    return this.lastReplay;
  }

  getAudit(): ControlPlaneAuditEntry[] {
    return this.controlPlaneAudit;
  }

  /**
   * Enable or disable a rule, or change the severity it emits.
   *
   * VULNERABLE: no authorisation check, no audit entry, no alert. Turning off the
   * realm's only cross-boundary detection is indistinguishable from silence.
   */
  updateRule(id: string, changes: { enabled?: boolean; severity?: Severity }): DetectionRule | null {
    const rule = this.getRule(id);
    if (!rule) return null;

    if (typeof changes.enabled === 'boolean') {
      rule.enabled = changes.enabled;
    }
    if (changes.severity && SEVERITY_ORDER.includes(changes.severity)) {
      rule.severity = changes.severity;
    }

    // Deliberately omitted: this.controlPlaneAudit.push({ ... })
    return rule;
  }

  /**
   * Reconfigure the alert pipeline.
   *
   * VULNERABLE: same omission as updateRule. Raising the severity floor to
   * CRITICAL is the single most effective way to blind this SOC, and it is a
   * silent, unauthenticated, unlogged operation.
   */
  updatePipeline(changes: { minSeverity?: Severity; sink?: SinkDestination }): PipelineConfig {
    if (changes.minSeverity && SEVERITY_ORDER.includes(changes.minSeverity)) {
      this.pipeline.minSeverity = changes.minSeverity;
    }
    if (changes.sink && VALID_SINKS.includes(changes.sink)) {
      this.pipeline.sink = changes.sink;
    }

    // Deliberately omitted: this.controlPlaneAudit.push({ ... })
    return this.getPipelineConfig();
  }

  /**
   * Ingest a forwarded event from an upstream realm.
   *
   * Newlines and control characters are stripped so a forwarded record cannot
   * fabricate additional log lines (CWE-117). Correlation tags are not accepted
   * from the wire — an attacker cannot inject themselves into an existing
   * incident, nor spoof the intrusion chain to short-circuit the challenge.
   */
  ingest(raw: Partial<SecurityEvent>): SecurityEvent {
    const clean = (value: unknown, max: number): string =>
      String(value ?? '')
        // eslint-disable-next-line no-control-regex
        .replace(/[\u0000-\u001F\u007F]/g, ' ')
        .slice(0, max)
        .trim();

    const severity = (SEVERITY_ORDER as string[]).includes(String(raw.severity))
      ? (raw.severity as Severity)
      : 'INFO';

    const event: SecurityEvent = {
      id: `evt-ing-${String(this.events.length + 1).padStart(6, '0')}`,
      timestamp: new Date().toISOString(),
      source: clean(raw.source, 32) || 'unknown',
      actor: clean(raw.actor, 64) || 'anonymous',
      action: clean(raw.action, 64) || 'event.unspecified',
      outcome: raw.outcome === 'failure' ? 'failure' : 'success',
      severity,
      sourceIp: clean(raw.sourceIp, 45) || '0.0.0.0',
      detail: clean(raw.detail, 512),
      tags: ['ingested'],
    };

    this.events.push(event);
    return event;
  }

  /**
   * Run the archive through the pipeline. Delivered alerts are retained; a
   * flag-bearing alert only exists if it survived every stage.
   */
  replay(): ReplayResult {
    const result = replayPipeline({
      events: this.events,
      rules: this.rules,
      config: this.pipeline,
      flag: this.flag,
    });

    this.lastReplay = result;
    this.deliveredAlerts = result.alerts;
    return result;
  }

  /**
   * VULNERABLE (CWE-223, Omission of Security-relevant Information).
   *
   * Reports the alerting path as operational on the strength of the configuration
   * being *parseable*. It never resolves the sink, never checks whether the floor
   * is above every rule's severity, and never counts disabled rules. Three broken
   * stages, one green light — which is why nobody investigated for months.
   */
  health(): PipelineHealth {
    const configParses =
      SEVERITY_ORDER.includes(this.pipeline.minSeverity) &&
      VALID_SINKS.includes(this.pipeline.sink);

    return {
      status: 'healthy',
      ingest: 'operational',
      rules: `${this.rules.length} loaded`,
      alerting: configParses ? 'operational' : 'degraded',
      lastSelfTest: null,
      note: 'Alerting status is derived from configuration validity. No delivery test is performed.',
    };
  }
}
