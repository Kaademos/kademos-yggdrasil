/**
 * Detection Engine Unit Tests
 *
 * Covers the three independent misconfigurations that make Helheim an A09 realm,
 * and pins the property the challenge depends on: the flag exists only inside a
 * delivered alert from the correlation rule.
 */

import {
  DEFAULT_PIPELINE_CONFIG,
  DetectionRule,
  PipelineConfig,
  defaultRules,
  matchRule,
  replayPipeline,
  severityRank,
} from '../../src/services/detection-engine';
import {
  buildEventArchive,
  FENRIR_CORRELATION_ID,
  FENRIR_EVENT_IDS,
  FENRIR_SOURCE_IP,
  SecurityEvent,
} from '../../src/data/event-archive';

const TEST_FLAG = 'YGGDRASIL{HELHEIM:11111111-2222-3333-4444-555555555555}';

let events: SecurityEvent[];

beforeAll(() => {
  events = buildEventArchive();
});

function rulesWith(overrides: Partial<DetectionRule> & { id: string }): DetectionRule[] {
  return defaultRules().map((r) => (r.id === overrides.id ? { ...r, ...overrides } : r));
}

function workingConfig(): PipelineConfig {
  return { minSeverity: 'HIGH', sink: 'soc-queue' };
}

describe('event archive', () => {
  it('is deterministic across builds', () => {
    expect(JSON.stringify(buildEventArchive())).toBe(JSON.stringify(buildEventArchive()));
  });

  it('contains the full Fenrir chain', () => {
    const ids = events.map((e) => e.id);
    for (const id of FENRIR_EVENT_IDS) {
      expect(ids).toContain(id);
    }
  });

  it('never contains a flag anywhere in the archive', () => {
    expect(JSON.stringify(events)).not.toMatch(/YGGDRASIL\{/i);
  });

  it('is sorted by timestamp', () => {
    const timestamps = events.map((e) => e.timestamp);
    expect([...timestamps].sort()).toEqual(timestamps);
  });
});

describe('severityRank', () => {
  it('orders severities low to high', () => {
    expect(severityRank('INFO')).toBeLessThan(severityRank('LOW'));
    expect(severityRank('LOW')).toBeLessThan(severityRank('MEDIUM'));
    expect(severityRank('MEDIUM')).toBeLessThan(severityRank('HIGH'));
    expect(severityRank('HIGH')).toBeLessThan(severityRank('CRITICAL'));
  });
});

describe('correlation rule HEL-R007', () => {
  const rule = () => defaultRules().find((r) => r.id === 'HEL-R007')!;

  it('ships disabled', () => {
    expect(rule().enabled).toBe(false);
  });

  it('matches the intrusion exactly once', () => {
    const groups = matchRule(rule(), events);
    expect(groups).toHaveLength(1);
  });

  it('matches the three-step signature, in order, across the realm boundary', () => {
    const [chain] = matchRule(rule(), events);

    
    expect(chain.map((e) => e.id)).toEqual(['evt-001204', 'evt-001207', 'evt-001208']);
    expect(chain.every((e) => e.sourceIp === FENRIR_SOURCE_IP)).toBe(true);
    expect(chain[0].source).toBe('niflheim');
    expect(chain[chain.length - 1].source).toBe('helheim');
  });

  it('does not match the decoys', () => {
    const [chain] = matchRule(rule(), events);
    const matchedIds = new Set(chain.map((e) => e.id));

    expect(matchedIds.has('evt-000602')).toBe(false);
    expect(matchedIds.has('evt-000871')).toBe(false);
    expect(matchedIds.has('evt-001455')).toBe(false);
  });

  it('will not match once the correlation window is too tight', () => {
    const tight = rule();
    if (tight.matcher.kind !== 'correlation') throw new Error('expected a correlation matcher');

    tight.matcher = { ...tight.matcher, windowMinutes: 1 };
    expect(matchRule(tight, events)).toHaveLength(0);
  });
});

describe('single-event rules', () => {
  it('HEL-R004 fires on the drill as well as the real release', () => {
    const r004 = defaultRules().find((r) => r.id === 'HEL-R004')!;
    const matched = matchRule(r004, events).flat().map((e) => e.id);

    expect(matched).toContain('evt-001205'); // intrusion
    expect(matched).toContain('evt-000871'); // scheduled drill
  });
});

describe('replayPipeline — shipped configuration', () => {
  it('delivers nothing', () => {
    const result = replayPipeline({
      events,
      rules: defaultRules(),
      config: { ...DEFAULT_PIPELINE_CONFIG },
      flag: TEST_FLAG,
    });

    expect(result.counters.delivered).toBe(0);
    expect(result.alerts).toHaveLength(0);
  });

  it('skips the disabled correlation rule without evaluating it', () => {
    const result = replayPipeline({
      events,
      rules: defaultRules(),
      config: { ...DEFAULT_PIPELINE_CONFIG },
      flag: TEST_FLAG,
    });

    expect(result.counters.rulesSkippedDisabled).toBe(1);
  });

  it('never leaks the flag when nothing is delivered', () => {
    const result = replayPipeline({
      events,
      rules: defaultRules(),
      config: { ...DEFAULT_PIPELINE_CONFIG },
      flag: TEST_FLAG,
    });

    expect(JSON.stringify(result)).not.toContain(TEST_FLAG);
  });
});

describe('replayPipeline — each stage in isolation', () => {
  it('the severity floor alone suppresses every alert', () => {
    const result = replayPipeline({
      events,
      rules: rulesWith({ id: 'HEL-R007', enabled: true }),
      config: { minSeverity: 'CRITICAL', sink: 'soc-queue' },
      flag: TEST_FLAG,
    });

    expect(result.counters.matched).toBeGreaterThan(0);
    expect(result.counters.droppedBySeverityFilter).toBe(result.counters.matched);
    expect(result.counters.delivered).toBe(0);
    expect(result.diagnostics.join(' ')).toMatch(/severity filter/);
  });

  it('the null sink alone suppresses every alert', () => {
    const result = replayPipeline({
      events,
      rules: rulesWith({ id: 'HEL-R007', enabled: true }),
      config: { minSeverity: 'HIGH', sink: 'null' },
      flag: TEST_FLAG,
    });

    
    expect(result.counters.droppedBySink).toBeGreaterThan(0);
    expect(result.counters.droppedBySeverityFilter + result.counters.droppedBySink).toBe(
      result.counters.matched
    );
    expect(result.counters.delivered).toBe(0);
    expect(result.diagnostics.join(' ')).toMatch(/decommissioned collector/);
  });

  it('a disabled rule alone suppresses the flag-bearing alert', () => {
    const result = replayPipeline({
      events,
      rules: defaultRules(),
      config: workingConfig(),
      flag: TEST_FLAG,
    });

    expect(result.counters.delivered).toBeGreaterThan(0);
    expect(result.alerts.some((a) => a.flag)).toBe(false);
  });
});

describe('replayPipeline — fully repaired', () => {
  const repaired = () =>
    replayPipeline({
      events,
      rules: rulesWith({ id: 'HEL-R007', enabled: true }),
      config: workingConfig(),
      flag: TEST_FLAG,
    });

  it('delivers the correlation alert', () => {
    const result = repaired();
    const alert = result.alerts.find((a) => a.ruleId === 'HEL-R007');

    expect(alert).toBeDefined();
    expect(alert!.severity).toBe('HIGH');
    expect(alert!.correlationId).toBe(FENRIR_CORRELATION_ID);
  });

  it('widens the alert to the whole incident, not just the trigger events', () => {
    const alert = repaired().alerts.find((a) => a.ruleId === 'HEL-R007')!;

    
    expect(alert.events.map((e) => e.id)).toEqual(FENRIR_EVENT_IDS);
    expect(alert.events.every((e) => e.sourceIp === FENRIR_SOURCE_IP)).toBe(true);
  });

  it('excludes same-host activity outside the incident window', () => {
    const alert = repaired().alerts.find((a) => a.ruleId === 'HEL-R007')!;

    expect(alert.events.map((e) => e.id)).not.toContain('evt-000602');
  });

  it('releases the flag on that alert and no other', () => {
    const result = repaired();
    const bearers = result.alerts.filter((a) => a.flag);

    expect(bearers).toHaveLength(1);
    expect(bearers[0].ruleId).toBe('HEL-R007');
    expect(bearers[0].flag).toBe(TEST_FLAG);
  });

  it('reports delivery honestly', () => {
    const result = repaired();

    expect(result.counters.delivered).toBe(result.alerts.length);
    expect(result.counters.droppedBySink).toBe(0);
    expect(result.diagnostics.join(' ')).toMatch(/alert\(s\) delivered/);
  });
});
