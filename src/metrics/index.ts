import { metrics, Histogram, Counter, Attributes } from '@opentelemetry/api';

const METER_NAME = 'moleculer-otel';

/**
 * Metrics configuration options
 */
export interface MetricsOptions {
  /** Enable metrics collection (default: false) */
  enabled?: boolean;
  /** Histogram buckets for action duration in milliseconds */
  durationBuckets?: number[];
  /** Prefix for metric names (default: 'moleculer') */
  prefix?: string;
}

let metricsInstance: MoleculerMetrics | null = null;

/**
 * Moleculer metrics collector using OpenTelemetry Metrics API
 */
export class MoleculerMetrics {
  private actionDuration: Histogram;
  private actionCalls: Counter;
  private actionErrors: Counter;
  private eventEmits: Counter;
  private prefix: string;

  constructor(options: MetricsOptions = {}) {
    this.prefix = options.prefix ?? 'moleculer';
    const meter = metrics.getMeter(METER_NAME);

    // Action duration histogram
    this.actionDuration = meter.createHistogram(`${this.prefix}.action.duration`, {
      description: 'Duration of Moleculer action calls in milliseconds',
      unit: 'ms',
    });

    // Action call counter
    this.actionCalls = meter.createCounter(`${this.prefix}.action.calls`, {
      description: 'Total number of Moleculer action calls',
    });

    // Action error counter
    this.actionErrors = meter.createCounter(`${this.prefix}.action.errors`, {
      description: 'Total number of Moleculer action errors',
    });

    // Event emit counter
    this.eventEmits = meter.createCounter(`${this.prefix}.event.emits`, {
      description: 'Total number of Moleculer events emitted',
    });
  }

  /**
   * Record an action call with duration
   */
  recordAction(
    actionName: string,
    durationMs: number,
    success: boolean,
    attributes?: Attributes
  ): void {
    const baseAttrs: Attributes = {
      'moleculer.action': actionName,
      'moleculer.service': actionName.split('.')[0],
      ...attributes,
    };

    // Record duration
    this.actionDuration.record(durationMs, baseAttrs);

    // Increment call counter
    this.actionCalls.add(1, { ...baseAttrs, success });

    // Increment error counter if failed
    if (!success) {
      this.actionErrors.add(1, baseAttrs);
    }
  }

  /**
   * Record an event emission
   */
  recordEvent(
    eventName: string,
    type: 'emit' | 'broadcast',
    attributes?: Attributes
  ): void {
    this.eventEmits.add(1, {
      'moleculer.event': eventName,
      'moleculer.event.type': type,
      ...attributes,
    });
  }
}

/**
 * Gets or creates the metrics singleton
 */
export function getMetrics(options?: MetricsOptions): MoleculerMetrics {
  if (!metricsInstance) {
    metricsInstance = new MoleculerMetrics(options);
  }
  return metricsInstance;
}

/**
 * Resets the metrics instance (useful for testing)
 */
export function resetMetrics(): void {
  metricsInstance = null;
}
