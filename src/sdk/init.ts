import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import {
  BatchSpanProcessor,
  SimpleSpanProcessor,
  AlwaysOnSampler,
  AlwaysOffSampler,
  TraceIdRatioBasedSampler,
  ParentBasedSampler,
  Sampler,
} from '@opentelemetry/sdk-trace-node';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';

/**
 * Batch processor configuration options
 */
export interface BatchProcessorOptions {
  /** Maximum queue size. After this, spans are dropped. (default: 2048) */
  maxQueueSize?: number;
  /** Maximum batch size for each export. (default: 512) */
  maxExportBatchSize?: number;
  /** Delay interval between exports in milliseconds. (default: 5000) */
  scheduledDelayMillis?: number;
  /** Timeout for each export in milliseconds. (default: 30000) */
  exportTimeoutMillis?: number;
}

/**
 * Sampling strategy type
 */
export type SamplingStrategy =
  | 'always_on'      // Sample all traces (default)
  | 'always_off'     // Sample no traces
  | 'ratio'          // Sample based on trace ID ratio (probabilistic)
  | 'parent_based';  // Sample based on parent span decision

/**
 * Sampling configuration options
 */
export interface SamplingOptions {
  /**
   * Sampling strategy to use
   * - 'always_on': Sample all traces (default)
   * - 'always_off': Sample no traces (useful for testing)
   * - 'ratio': Probabilistic sampling based on trace ID
   * - 'parent_based': Inherit sampling decision from parent span
   */
  strategy?: SamplingStrategy;
  /**
   * Sampling ratio for 'ratio' and 'parent_based' strategies (0.0 to 1.0)
   * Example: 0.1 = sample 10% of traces
   * Default: 1.0 (sample all)
   */
  ratio?: number;
}

/**
 * Options for initializing the OpenTelemetry SDK
 */
export interface OTelInitOptions {
  /** Service name for traces (default: process.env.SERVICE_NAME || 'moleculer-service') */
  serviceName?: string;
  /** Service version (default: process.env.SERVICE_VERSION || '1.0.0') */
  serviceVersion?: string;
  /** Deployment environment (default: process.env.NODE_ENV || 'development') */
  environment?: string;
  /** OTLP endpoint URL (default: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces') */
  endpoint?: string;
  /** Additional resource attributes */
  resourceAttributes?: Record<string, string>;
  /** Enable console logging (default: true) */
  logging?: boolean;
  /**
   * Use batch processor for production (default: true in production, false otherwise)
   * Set to false to use SimpleSpanProcessor (sends immediately, good for development)
   */
  batchProcessor?: boolean;
  /** Batch processor options (only used if batchProcessor is true) */
  batchOptions?: BatchProcessorOptions;
  /** Sampling configuration for controlling which traces are recorded */
  sampling?: SamplingOptions;
  /**
   * Additional OpenTelemetry instrumentations to register.
   * Use this to add auto-instrumentation for HTTP, databases, etc.
   *
   * @example
   * ```typescript
   * import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
   * import { MongoDBInstrumentation } from '@opentelemetry/instrumentation-mongodb';
   *
   * initOTel({
   *   instrumentations: [
   *     new HttpInstrumentation(),
   *     new MongoDBInstrumentation(),
   *   ],
   * });
   * ```
   */
  instrumentations?: unknown[];
}

let sdkInstance: NodeSDK | null = null;

/**
 * Creates a sampler based on the provided options
 */
function createSampler(options?: SamplingOptions): Sampler {
  const strategy = options?.strategy ?? 'always_on';
  const ratio = options?.ratio ?? 1.0;

  switch (strategy) {
    case 'always_off':
      return new AlwaysOffSampler();
    case 'ratio':
      return new TraceIdRatioBasedSampler(ratio);
    case 'parent_based':
      // Parent-based sampler with ratio-based root sampler
      return new ParentBasedSampler({
        root: new TraceIdRatioBasedSampler(ratio),
      });
    case 'always_on':
    default:
      return new AlwaysOnSampler();
  }
}

/**
 * Initialize the OpenTelemetry SDK with sensible defaults.
 *
 * IMPORTANT: Call this at the very top of your entry file, before importing
 * any other modules (including Moleculer).
 *
 * @example
 * ```typescript
 * // moleculer.config.ts
 * import { initOTel, createOTelMiddleware } from 'moleculer-otel';
 *
 * // Initialize OTEL first
 * initOTel({
 *   serviceName: 'my-service',
 *   endpoint: 'https://jaeger-http-col.example.com/v1/traces',
 * });
 *
 * export default {
 *   middlewares: [createOTelMiddleware()],
 * };
 * ```
 *
 * @param options - SDK initialization options
 * @returns The NodeSDK instance
 */
export function initOTel(options: OTelInitOptions = {}): NodeSDK {
  if (sdkInstance) {
    if (options.logging !== false) {
      console.log('[OTEL] SDK already initialized, returning existing instance');
    }
    return sdkInstance;
  }

  const serviceName = options.serviceName || process.env.SERVICE_NAME || 'moleculer-service';
  const serviceVersion = options.serviceVersion || process.env.SERVICE_VERSION || '1.0.0';
  const environment = options.environment || process.env.NODE_ENV || 'development';
  const endpoint = options.endpoint || process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces';

  if (options.logging !== false) {
    console.log(`[OTEL] Service: ${serviceName}`);
    console.log(`[OTEL] Exporting traces to: ${endpoint}`);
  }

  const resourceAttributes: Record<string, string> = {
    [ATTR_SERVICE_NAME]: serviceName,
    [ATTR_SERVICE_VERSION]: serviceVersion,
    'deployment.environment': environment,
    ...options.resourceAttributes,
  };

  // Create the exporter
  const exporter = new OTLPTraceExporter({
    url: endpoint,
  });

  // Determine if we should use batch processor
  // Default: batch in production, simple in development
  const useBatch = options.batchProcessor ?? (environment === 'production');

  // Create span processor based on configuration
  const spanProcessor = useBatch
    ? new BatchSpanProcessor(exporter, {
        maxQueueSize: options.batchOptions?.maxQueueSize ?? 2048,
        maxExportBatchSize: options.batchOptions?.maxExportBatchSize ?? 512,
        scheduledDelayMillis: options.batchOptions?.scheduledDelayMillis ?? 5000,
        exportTimeoutMillis: options.batchOptions?.exportTimeoutMillis ?? 30000,
      })
    : new SimpleSpanProcessor(exporter);

  // Create sampler based on configuration
  const sampler = createSampler(options.sampling);
  const samplingStrategy = options.sampling?.strategy ?? 'always_on';
  const samplingRatio = options.sampling?.ratio ?? 1.0;

  if (options.logging !== false) {
    console.log(`[OTEL] Span processor: ${useBatch ? 'BatchSpanProcessor' : 'SimpleSpanProcessor'}`);
    if (samplingStrategy !== 'always_on') {
      console.log(`[OTEL] Sampling: ${samplingStrategy}${samplingStrategy === 'ratio' || samplingStrategy === 'parent_based' ? ` (${(samplingRatio * 100).toFixed(1)}%)` : ''}`);
    }
  }

  // Log instrumentations if any
  if (options.logging !== false && options.instrumentations?.length) {
    console.log(`[OTEL] Instrumentations: ${options.instrumentations.length} registered`);
  }

  const sdk = new NodeSDK({
    resource: new Resource(resourceAttributes),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    spanProcessor: spanProcessor as any,
    sampler,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    instrumentations: options.instrumentations as any,
  });

  sdk.start();
  sdkInstance = sdk;

  // Graceful shutdown
  const shutdown = async () => {
    try {
      await sdk.shutdown();
      if (options.logging !== false) {
        console.log('[OTEL] SDK shut down successfully');
      }
    } catch (err) {
      console.error('[OTEL] Error shutting down SDK:', err);
    }
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  return sdk;
}

/**
 * Get the current SDK instance, if initialized.
 */
export function getOTelSDK(): NodeSDK | null {
  return sdkInstance;
}

/**
 * Manually shutdown the SDK.
 */
export async function shutdownOTel(): Promise<void> {
  if (sdkInstance) {
    await sdkInstance.shutdown();
    sdkInstance = null;
  }
}
