import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

export class MetricsRegistry {
  private static instance: MetricsRegistry;
  public readonly register: Registry;

  public readonly httpRequestsTotal: Counter;
  public readonly httpRequestDuration: Histogram;
  public readonly flagSubmissionsTotal: Counter;
  public readonly realmAccessTotal: Counter;
  public readonly forbiddenAccessTotal: Counter;
  public readonly activeSessionsGauge: Gauge;

  private constructor() {
    this.register = new Registry();

    collectDefaultMetrics({ register: this.register });

    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'path', 'status', 'service'],
      registers: [this.register],
    });

    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'path', 'service'],
      buckets: [0.1, 0.5, 1, 2, 5],
      registers: [this.register],
    });

    this.flagSubmissionsTotal = new Counter({
      name: 'flag_submissions_total',
      help: 'Total number of flag submissions',
      labelNames: ['result', 'realm'],
      registers: [this.register],
    });

    this.realmAccessTotal = new Counter({
      name: 'realm_access_total',
      help: 'Total number of realm access attempts',
      labelNames: ['realm', 'status'],
      registers: [this.register],
    });

    this.forbiddenAccessTotal = new Counter({
      name: 'forbidden_access_total',
      help: 'Total number of forbidden access attempts',
      labelNames: ['realm'],
      registers: [this.register],
    });

    this.activeSessionsGauge = new Gauge({
      name: 'active_sessions',
      help: 'Number of active user sessions',
      registers: [this.register],
    });
  }

  public static getInstance(): MetricsRegistry {
    if (!MetricsRegistry.instance) {
      MetricsRegistry.instance = new MetricsRegistry();
    }
    return MetricsRegistry.instance;
  }

  public async getMetrics(): Promise<string> {
    return this.register.metrics();
  }
}

export const metrics = MetricsRegistry.getInstance();
