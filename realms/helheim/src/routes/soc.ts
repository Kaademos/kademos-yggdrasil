/**
 * Níðhöggr SOC Console API
 *
 * VULNERABILITY: A09:2025 - Logging & Alerting Failures
 *
 * Everything needed to detect the buried intrusion is present and correct: the
 * events, the rule that describes the pattern, and a working delivery path. The
 * realm ships with all three decoupled, and with a health endpoint that calls the
 * result "operational".
 *
 * The flag is never stored, never queryable, and never present in the archive.
 * It exists only inside an alert produced by the flag-bearing rule *after* that
 * alert has survived the severity filter and been accepted by a live sink. If no
 * alert reaches an operator, there is no flag — which is the entire point of the
 * 2025 rename from "Logging & Monitoring" to "Logging & Alerting".
 */

import { Router, Request, Response } from 'express';
import { SecurityEvent, Severity } from '../data/event-archive';
import { SEVERITY_ORDER } from '../services/detection-engine';
import { SocState, VALID_SINKS } from '../services/soc-state';

const MAX_PAGE_SIZE = 200;

function parseLimit(value: unknown, fallback: number): number {
  const parsed = parseInt(String(value ?? ''), 10);
  if (isNaN(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, MAX_PAGE_SIZE);
}

function applyFilters(events: SecurityEvent[], query: Request['query']): SecurityEvent[] {
  let filtered = events;

  const eq = (field: keyof SecurityEvent, key: string) => {
    const wanted = query[key];
    if (typeof wanted !== 'string' || wanted.length === 0) return;
    filtered = filtered.filter(
      (e) => String(e[field]).toLowerCase() === wanted.toLowerCase()
    );
  };

  eq('source', 'source');
  eq('action', 'action');
  eq('severity', 'severity');
  eq('sourceIp', 'sourceIp');
  eq('actor', 'actor');
  eq('outcome', 'outcome');

  const search = query.q;
  if (typeof search === 'string' && search.length > 0) {
    const needle = search.toLowerCase();
    filtered = filtered.filter(
      (e) =>
        e.detail.toLowerCase().includes(needle) ||
        e.action.toLowerCase().includes(needle) ||
        e.id.toLowerCase().includes(needle)
    );
  }

  return filtered;
}

export function createSocRouter(state: SocState): Router {
  const router = Router();

  /**
   * GET /api/soc/events
   * Query the forwarded event archive.
   */
  router.get('/api/soc/events', (req: Request, res: Response) => {
    const filtered = applyFilters(state.getEvents(), req.query);
    const limit = parseLimit(req.query.limit, 50);
    const offset = Math.max(0, parseInt(String(req.query.offset ?? '0'), 10) || 0);

    res.status(200).json({
      total: filtered.length,
      offset,
      limit,
      events: filtered.slice(offset, offset + limit),
    });
  });

  /**
   * GET /api/soc/events/:id
   */
  router.get('/api/soc/events/:id', (req: Request, res: Response) => {
    const event = state.getEvents().find((e) => e.id === req.params.id);
    if (!event) {
      return res.status(404).json({ error: 'Not found', message: 'No such event id' });
    }
    return res.status(200).json(event);
  });

  /**
   * GET /api/soc/rules
   * The detection catalogue, including whichever rules are switched off.
   */
  router.get('/api/soc/rules', (_req: Request, res: Response) => {
    const rules = state.getRules();
    res.status(200).json({
      total: rules.length,
      enabled: rules.filter((r) => r.enabled).length,
      disabled: rules.filter((r) => !r.enabled).length,
      rules: rules.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        enabled: r.enabled,
        severity: r.severity,
        kind: r.matcher.kind,
        note: r.note,
      })),
    });
  });

  /**
   * GET /api/soc/rules/:id
   */
  router.get('/api/soc/rules/:id', (req: Request, res: Response) => {
    const rule = state.getRule(req.params.id);
    if (!rule) {
      return res.status(404).json({ error: 'Not found', message: 'No such rule id' });
    }
    return res.status(200).json(rule);
  });

  /**
   * PATCH /api/soc/rules/:id
   *
   * VULNERABLE: enabling or disabling a detection rule is a security-critical
   * change. It is applied with no authorisation check beyond console access, no
   * audit record, and no notification.
   */
  router.patch('/api/soc/rules/:id', (req: Request, res: Response) => {
    const { enabled, severity } = req.body ?? {};

    if (severity !== undefined && !SEVERITY_ORDER.includes(severity as Severity)) {
      return res.status(400).json({
        error: 'Bad request',
        message: `severity must be one of ${SEVERITY_ORDER.join(', ')}`,
      });
    }

    const updated = state.updateRule(req.params.id, {
      enabled: typeof enabled === 'boolean' ? enabled : undefined,
      severity: severity as Severity | undefined,
    });

    if (!updated) {
      return res.status(404).json({ error: 'Not found', message: 'No such rule id' });
    }

    return res.status(200).json({
      message: 'Rule updated',
      rule: { id: updated.id, name: updated.name, enabled: updated.enabled, severity: updated.severity },
      auditRecorded: false,
    });
  });

  /**
   * GET /api/soc/pipeline/config
   */
  router.get('/api/soc/pipeline/config', (_req: Request, res: Response) => {
    res.status(200).json({
      ...state.getPipelineConfig(),
      validSinks: VALID_SINKS,
      validSeverities: SEVERITY_ORDER,
      sinkNotes: {
        null: 'Decommissioned collector. Accepts writes and discards them.',
        console: 'Writes alerts to the service log.',
        'soc-queue': 'Live operator queue.',
      },
    });
  });

  /**
   * PUT /api/soc/pipeline/config
   *
   * VULNERABLE: same omission as rule mutation. Raising minSeverity above every
   * rule's emitted severity silences the SOC completely and leaves no trace.
   */
  router.put('/api/soc/pipeline/config', (req: Request, res: Response) => {
    const { minSeverity, sink } = req.body ?? {};

    if (minSeverity !== undefined && !SEVERITY_ORDER.includes(minSeverity as Severity)) {
      return res.status(400).json({
        error: 'Bad request',
        message: `minSeverity must be one of ${SEVERITY_ORDER.join(', ')}`,
      });
    }
    if (sink !== undefined && !VALID_SINKS.includes(sink)) {
      return res.status(400).json({
        error: 'Bad request',
        message: `sink must be one of ${VALID_SINKS.join(', ')}`,
      });
    }

    const updated = state.updatePipeline({
      minSeverity: minSeverity as Severity | undefined,
      sink,
    });

    return res.status(200).json({
      message: 'Pipeline configuration updated',
      config: updated,
      auditRecorded: false,
    });
  });

  /**
   * GET /api/soc/pipeline/health
   *
   * VULNERABLE (CWE-223): reports the alerting path healthy without ever
   * exercising it. Green here means "the config parsed", not "an alert would
   * arrive".
   */
  router.get('/api/soc/pipeline/health', (_req: Request, res: Response) => {
    res.status(200).json(state.health());
  });

  /**
   * POST /api/soc/pipeline/replay
   *
   * Re-runs the archive through rules → severity filter → sink and reports what
   * each stage dropped. Delivered alerts carry their full event chain; the alert
   * from the flag-bearing rule carries the incident record.
   */
  router.post('/api/soc/pipeline/replay', (_req: Request, res: Response) => {
    const result = state.replay();

    res.status(200).json({
      message:
        result.counters.delivered > 0
          ? `${result.counters.delivered} alert(s) delivered`
          : 'No alerts reached an operator',
      config: state.getPipelineConfig(),
      counters: result.counters,
      diagnostics: result.diagnostics,
      alerts: result.alerts,
    });
  });

  /**
   * GET /api/soc/alerts
   * Alerts that actually reached the sink. Empty until the pipeline works.
   */
  router.get('/api/soc/alerts', (_req: Request, res: Response) => {
    const alerts = state.getAlerts();
    res.status(200).json({
      total: alerts.length,
      alerts,
      ...(alerts.length === 0 && {
        note: 'No alerts on record. Run POST /api/soc/pipeline/replay to evaluate the archive.',
      }),
    });
  });

  /**
   * GET /api/soc/audit
   *
   * VULNERABLE (CWE-778): the control-plane audit trail. Always empty, however
   * many rules have been switched off or however the pipeline has been retuned.
   */
  router.get('/api/soc/audit', (_req: Request, res: Response) => {
    const entries = state.getAudit();
    res.status(200).json({
      total: entries.length,
      entries,
      retention: '90d',
      covers: ['rule.enable', 'rule.disable', 'pipeline.reconfigure'],
      note: 'Control-plane changes are applied immediately.',
    });
  });

  /**
   * POST /api/soc/ingest
   * Accept a forwarded event from an upstream realm.
   */
  router.post('/api/soc/ingest', (req: Request, res: Response) => {
    const event = state.ingest(req.body ?? {});
    res.status(202).json({ message: 'Event ingested', event });
  });

  return router;
}
