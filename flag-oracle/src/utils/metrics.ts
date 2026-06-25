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
  readonly flagValidationsTotal: Metric;
  readonly progressionUpdatesTotal: Metric;
  readonly validationErrorsTotal: Metric;
  readonly userProgressionGauge: Metric;
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
    flagValidationsTotal: noopMetric,
    progressionUpdatesTotal: noopMetric,
    validationErrorsTotal: noopMetric,
    userProgressionGauge: noopMetric,
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
      buckets: [0.05, 0.1, 0.5, 1, 2],
      registers: [register],
    }),
    flagValidationsTotal: new Counter({
      name: 'flag_validations_total',
      help: 'Total number of flag validations',
      labelNames: ['result', 'realm'],
      registers: [register],
    }),
    progressionUpdatesTotal: new Counter({
      name: 'progression_updates_total',
      help: 'Total number of progression updates',
      labelNames: ['realm'],
      registers: [register],
    }),
    validationErrorsTotal: new Counter({
      name: 'validation_errors_total',
      help: 'Total number of validation errors',
      labelNames: ['error_type'],
      registers: [register],
    }),
    userProgressionGauge: new Gauge({
      name: 'user_progression_level',
      help: 'Current user progression level distribution',
      labelNames: ['level'],
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
