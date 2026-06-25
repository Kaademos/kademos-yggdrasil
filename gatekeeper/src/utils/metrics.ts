/**
 * Prometheus metrics registry — opt-in via OBSERVABILITY_ENABLED.
 *
 * When observability is disabled (the default for local/dev), `prom-client` is never
 * loaded and every instrument is a no-op. This keeps service startup lean; the heavy
 * default-metric collectors and registry are only created when the observability stack
 * (docker-compose.observability.yml) is actually in use.
 */

const OBSERVABILITY_ENABLED = process.env.OBSERVABILITY_ENABLED === 'true';
const PROM_CONTENT_TYPE = 'text/plain; version=0.0.4; charset=utf-8';

type Labels = Record<string, string | number>;

interface Metric {
  inc(labels?: Labels, value?: number): void;
  observe(labels: Labels, value: number): void;
  set(labelsOrValue?: Labels | number, value?: number): void;
}

export interface IMetricsRegistry {
  readonly register: { contentType: string };
  readonly httpRequestsTotal: Metric;
  readonly httpRequestDuration: Metric;
  readonly flagSubmissionsTotal: Metric;
  readonly realmAccessTotal: Metric;
  readonly forbiddenAccessTotal: Metric;
  readonly activeSessionsGauge: Metric;
  getMetrics(): Promise<string>;
}

const noopMetric: Metric = {
  inc() {},
  observe() {},
  set() {},
};

function createDisabledRegistry(): IMetricsRegistry {
  return {
    register: { contentType: PROM_CONTENT_TYPE },
    httpRequestsTotal: noopMetric,
    httpRequestDuration: noopMetric,
    flagSubmissionsTotal: noopMetric,
    realmAccessTotal: noopMetric,
    forbiddenAccessTotal: noopMetric,
    activeSessionsGauge: noopMetric,
    async getMetrics() {
      return '# Metrics disabled. Set OBSERVABILITY_ENABLED=true to enable.\n';
    },
  };
}

function createEnabledRegistry(): IMetricsRegistry {
  // Lazy require: prom-client is only loaded when observability is enabled.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } = require('prom-client');

  const register = new Registry();
  collectDefaultMetrics({ register });

  return {
    register,
    httpRequestsTotal: new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'path', 'status', 'service'],
      registers: [register],
    }),
    httpRequestDuration: new Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'path', 'service'],
      buckets: [0.1, 0.5, 1, 2, 5],
      registers: [register],
    }),
    flagSubmissionsTotal: new Counter({
      name: 'flag_submissions_total',
      help: 'Total number of flag submissions',
      labelNames: ['result', 'realm'],
      registers: [register],
    }),
    realmAccessTotal: new Counter({
      name: 'realm_access_total',
      help: 'Total number of realm access attempts',
      labelNames: ['realm', 'status'],
      registers: [register],
    }),
    forbiddenAccessTotal: new Counter({
      name: 'forbidden_access_total',
      help: 'Total number of forbidden access attempts',
      labelNames: ['realm'],
      registers: [register],
    }),
    activeSessionsGauge: new Gauge({
      name: 'active_sessions',
      help: 'Number of active user sessions',
      registers: [register],
    }),
    async getMetrics() {
      return register.metrics();
    },
  };
}

export const metricsEnabled = OBSERVABILITY_ENABLED;

export const metrics: IMetricsRegistry = OBSERVABILITY_ENABLED
  ? createEnabledRegistry()
  : createDisabledRegistry();
