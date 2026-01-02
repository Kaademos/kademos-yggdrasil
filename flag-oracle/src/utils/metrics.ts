import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

export class MetricsRegistry {
  private static instance: MetricsRegistry;
  public readonly register: Registry;

  public readonly httpRequestsTotal: Counter;
  public readonly httpRequestDuration: Histogram;
  public readonly flagValidationsTotal: Counter;
  public readonly progressionUpdatesTotal: Counter;
  public readonly validationErrorsTotal: Counter;
  public readonly userProgressionGauge: Gauge;

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
      buckets: [0.05, 0.1, 0.5, 1, 2],
      registers: [this.register],
    });

    this.flagValidationsTotal = new Counter({
      name: 'flag_validations_total',
      help: 'Total number of flag validations',
      labelNames: ['result', 'realm'],
      registers: [this.register],
    });

    this.progressionUpdatesTotal = new Counter({
      name: 'progression_updates_total',
      help: 'Total number of progression updates',
      labelNames: ['realm'],
      registers: [this.register],
    });

    this.validationErrorsTotal = new Counter({
      name: 'validation_errors_total',
      help: 'Total number of validation errors',
      labelNames: ['error_type'],
      registers: [this.register],
    });

    this.userProgressionGauge = new Gauge({
      name: 'user_progression_level',
      help: 'Current user progression level distribution',
      labelNames: ['level'],
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
