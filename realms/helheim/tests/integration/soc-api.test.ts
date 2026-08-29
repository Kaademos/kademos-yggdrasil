/**
 * SOC API and Memorial Forum — surface tests
 *
 * Covers querying, validation, and error handling around the exploit path, plus
 * the forum behaviour that feeds the archive.
 */

import request from 'supertest';
import { Application } from 'express';
import { createApp } from '../../src/index';
import { RealmConfig } from '../../src/config';
import { redactSecrets } from '../../src/routes/memorial';
import { FENRIR_SOURCE_IP } from '../../src/data/event-archive';

const FLAG = 'YGGDRASIL{HELHEIM:00000002-0000-4000-8000-000000000000}';
const CREDENTIAL = 'admin:IceBound2025';
const AUTH = 'Basic ' + Buffer.from(CREDENTIAL, 'utf-8').toString('base64');

function testConfig(): RealmConfig {
  return {
    port: 3000,
    flag: FLAG,
    realmName: 'helheim',
    nodeEnv: 'test',
    adminCredential: CREDENTIAL,
    correlatedRealm: 'niflheim',
  };
}

let app: Application;

beforeEach(() => {
  app = createApp(testConfig());
});

const authed = (path: string) => request(app).get(path).set('Authorization', AUTH);

describe('event query', () => {
  it('filters by source', async () => {
    const res = await authed('/api/soc/events?source=niflheim&limit=50');
    expect(res.body.events.every((e: { source: string }) => e.source === 'niflheim')).toBe(true);
  });

  it('filters by sourceIp and surfaces the attacker host', async () => {
    const res = await authed(`/api/soc/events?sourceIp=${FENRIR_SOURCE_IP}&limit=50`);
    expect(res.body.total).toBeGreaterThanOrEqual(5);
    expect(res.body.events.every((e: { sourceIp: string }) => e.sourceIp === FENRIR_SOURCE_IP)).toBe(true);
  });

  it('filters by action, severity, actor and outcome', async () => {
    const res = await authed(
      '/api/soc/events?action=door.emergency_unlock&severity=HIGH&actor=system&outcome=success'
    );
    expect(res.body.total).toBeGreaterThan(0);
    expect(res.body.events[0].action).toBe('door.emergency_unlock');
  });

  it('free-text searches detail, action and id', async () => {
    const res = await authed('/api/soc/events?q=PRESSURE_OVERFLOW');
    expect(res.body.total).toBeGreaterThan(0);
    expect(res.body.events[0].detail).toMatch(/PRESSURE_OVERFLOW/);
  });

  it('ignores empty filter values', async () => {
    const all = await authed('/api/soc/events?limit=1');
    const empty = await authed('/api/soc/events?source=&action=&limit=1');
    expect(empty.body.total).toBe(all.body.total);
  });

  it('clamps limit to the page maximum and floors bad values', async () => {
    const huge = await authed('/api/soc/events?limit=99999');
    expect(huge.body.events.length).toBeLessThanOrEqual(200);

    const bogus = await authed('/api/soc/events?limit=notanumber');
    expect(bogus.body.limit).toBe(50);

    const negative = await authed('/api/soc/events?limit=-5&offset=-10');
    expect(negative.body.limit).toBe(50);
    expect(negative.body.offset).toBe(0);
  });

  it('returns a single event by id, and 404 otherwise', async () => {
    const hit = await authed('/api/soc/events/evt-001204');
    expect(hit.status).toBe(200);
    expect(hit.body.action).toBe('pressure.regulate');

    const miss = await authed('/api/soc/events/evt-does-not-exist');
    expect(miss.status).toBe(404);
  });
});

describe('rule catalogue', () => {
  it('reports enabled and disabled counts', async () => {
    const res = await authed('/api/soc/rules');
    expect(res.body.total).toBe(7);
    expect(res.body.disabled).toBe(1);
    expect(res.body.enabled).toBe(6);
  });

  it('returns a rule by id, case-insensitively', async () => {
    const res = await authed('/api/soc/rules/hel-r007');
    expect(res.status).toBe(200);
    expect(res.body.matcher.kind).toBe('correlation');
  });

  it('404s an unknown rule id on read and on patch', async () => {
    expect((await authed('/api/soc/rules/HEL-R999')).status).toBe(404);

    const patch = await request(app)
      .patch('/api/soc/rules/HEL-R999')
      .set('Authorization', AUTH)
      .send({ enabled: true });
    expect(patch.status).toBe(404);
  });

  it('rejects an invalid severity', async () => {
    const res = await request(app)
      .patch('/api/soc/rules/HEL-R007')
      .set('Authorization', AUTH)
      .send({ severity: 'APOCALYPTIC' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/severity must be one of/);
  });

  it('applies a severity change and reports no audit was written', async () => {
    const res = await request(app)
      .patch('/api/soc/rules/HEL-R007')
      .set('Authorization', AUTH)
      .send({ enabled: true, severity: 'CRITICAL' });

    expect(res.status).toBe(200);
    expect(res.body.rule.severity).toBe('CRITICAL');
    expect(res.body.auditRecorded).toBe(false);
  });

  it('ignores a non-boolean enabled value', async () => {
    const res = await request(app)
      .patch('/api/soc/rules/HEL-R007')
      .set('Authorization', AUTH)
      .send({ enabled: 'yes please' });

    expect(res.status).toBe(200);
    expect(res.body.rule.enabled).toBe(false);
  });
});

describe('pipeline configuration', () => {
  it('rejects an invalid severity floor', async () => {
    const res = await request(app)
      .put('/api/soc/pipeline/config')
      .set('Authorization', AUTH)
      .send({ minSeverity: 'SPICY' });

    expect(res.status).toBe(400);
  });

  it('rejects an unknown sink', async () => {
    const res = await request(app)
      .put('/api/soc/pipeline/config')
      .set('Authorization', AUTH)
      .send({ sink: 'carrier-pigeon' });

    expect(res.status).toBe(400);
  });

  it('accepts a partial update', async () => {
    const res = await request(app)
      .put('/api/soc/pipeline/config')
      .set('Authorization', AUTH)
      .send({ sink: 'console' });

    expect(res.body.config.sink).toBe('console');
    expect(res.body.config.minSeverity).toBe('CRITICAL');
  });

  it('describes what each sink does', async () => {
    const res = await authed('/api/soc/pipeline/config');
    expect(res.body.sinkNotes.null).toMatch(/discards/i);
    expect(res.body.validSinks).toEqual(['null', 'console', 'soc-queue']);
  });

  it('delivers through the console sink as well as the queue', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    await request(app)
      .patch('/api/soc/rules/HEL-R007')
      .set('Authorization', AUTH)
      .send({ enabled: true });
    await request(app)
      .put('/api/soc/pipeline/config')
      .set('Authorization', AUTH)
      .send({ minSeverity: 'HIGH', sink: 'console' });

    const res = await request(app).post('/api/soc/pipeline/replay').set('Authorization', AUTH);

    expect(res.body.counters.delivered).toBeGreaterThan(0);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('ingest', () => {
  it('defaults every unsupplied field', async () => {
    const res = await request(app).post('/api/soc/ingest').set('Authorization', AUTH).send({});

    expect(res.status).toBe(202);
    expect(res.body.event.source).toBe('unknown');
    expect(res.body.event.actor).toBe('anonymous');
    expect(res.body.event.action).toBe('event.unspecified');
    expect(res.body.event.severity).toBe('INFO');
    expect(res.body.event.outcome).toBe('success');
    expect(res.body.event.sourceIp).toBe('0.0.0.0');
  });

  it('falls back to INFO for an unknown severity', async () => {
    const res = await request(app)
      .post('/api/soc/ingest')
      .set('Authorization', AUTH)
      .send({ severity: 'CATASTROPHIC' });

    expect(res.body.event.severity).toBe('INFO');
  });

  it('records a forwarded failure outcome', async () => {
    const res = await request(app)
      .post('/api/soc/ingest')
      .set('Authorization', AUTH)
      .send({ outcome: 'failure', severity: 'MEDIUM' });

    expect(res.body.event.outcome).toBe('failure');
    expect(res.body.event.severity).toBe('MEDIUM');
  });

  it('truncates oversized fields', async () => {
    const res = await request(app)
      .post('/api/soc/ingest')
      .set('Authorization', AUTH)
      .send({ detail: 'x'.repeat(5000) });

    expect(res.body.event.detail.length).toBeLessThanOrEqual(512);
  });
});

describe('memorial forum', () => {
  it('creates a memorial and forwards the event', async () => {
    const create = await request(app)
      .post('/api/memorial')
      .send({ name: 'Sigrun', message: 'Remembered at the gate.' });

    expect(create.status).toBe(201);
    expect(create.body.memorial.name).toBe('Sigrun');

    const events = await authed('/api/soc/events?action=memorial.create&limit=5');
    expect(events.body.total).toBeGreaterThan(0);
  });

  it('rejects a submission with missing fields', async () => {
    const res = await request(app).post('/api/memorial').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });

  it('rejects a submission with the wrong types', async () => {
    const res = await request(app).post('/api/memorial').send({ name: 42, message: 7 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Type validation failed');
  });

  it('rejects oversized content', async () => {
    const res = await request(app)
      .post('/api/memorial')
      .send({ name: 'a'.repeat(101), message: 'b'.repeat(501) });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Content too long');
  });

  it('forwards validation failures into the archive', async () => {
    await request(app).post('/api/memorial').send({});

    const events = await authed('/api/soc/events?action=memorial.validation_error&limit=5');
    expect(events.body.total).toBeGreaterThan(0);
    expect(events.body.events[0].outcome).toBe('failure');
  });
});

describe('redactSecrets', () => {
  it('strips flags', () => {
    expect(redactSecrets(`leak ${FLAG} here`)).toBe('leak [REDACTED:FLAG] here');
  });

  it('strips authorization headers and inline credentials', () => {
    expect(redactSecrets('authorization: Basic abcdef')).toMatch(/\[REDACTED\]/);
    expect(redactSecrets('http://admin:IceBound2025@helheim:3000')).toMatch(/REDACTED:CREDENTIAL/);
  });

  it('leaves ordinary text untouched', () => {
    expect(redactSecrets('pressure regulation nominal')).toBe('pressure regulation nominal');
  });
});
