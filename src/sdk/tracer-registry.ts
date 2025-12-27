import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { Resource } from '@opentelemetry/resources';
import {
  BatchSpanProcessor,
  SimpleSpanProcessor,
  SpanExporter,
} from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Tracer } from '@opentelemetry/api';
import type { BatchProcessorOptions } from './init';

const TRACER_NAME = 'moleculer-otel';

/**
 * Options for initializing the TracerProviderRegistry
 */
export interface RegistryOptions {
  /** OTLP endpoint URL for trace export */
  endpoint?: string;
  /** Custom exporter instance (overrides endpoint) */
  exporter?: SpanExporter;
  /** Additional resource attributes shared by all services */
  resourceAttributes?: Record<string, string>;
  /** Batch processor options */
  batchOptions?: BatchProcessorOptions;
  /**
   * Use batch processor (default: true in production)
   * Set to false for SimpleSpanProcessor (immediate export, good for development)
   */
  useBatch?: boolean;
  /** Enable console logging (default: true) */
  logging?: boolean;
}

let registryInstance: TracerProviderRegistry | null = null;

/**
 * Registry that manages multiple TracerProviders, one per Moleculer service.
 * This allows each service to appear as a separate service in Jaeger.
 *
 * Each TracerProvider has its own Resource with a unique service.name,
 * but they all share a single exporter for efficiency.
 */
export class TracerProviderRegistry {
  private providers = new Map<string, NodeTracerProvider>();
  private exporter: SpanExporter;
  private baseAttributes: Record<string, string>;
  private batchOptions: BatchProcessorOptions;
  private useBatch: boolean;
  private logging: boolean;
  private isFirstProvider = true;

  constructor(options: RegistryOptions) {
    const endpoint = options.endpoint || process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces';
    const environment = process.env.NODE_ENV || 'development';

    this.exporter = options.exporter || new OTLPTraceExporter({ url: endpoint });
    this.baseAttributes = options.resourceAttributes || {};
    this.batchOptions = options.batchOptions || {};
    this.useBatch = options.useBatch ?? (environment === 'production');
    this.logging = options.logging ?? true;

    if (this.logging) {
      console.log('[OTEL] TracerProviderRegistry initialized');
      console.log(`[OTEL] Exporting traces to: ${endpoint}`);
      console.log(`[OTEL] Multi-service mode: enabled`);
    }
  }

  /**
   * Get a tracer for the specified Moleculer service.
   * Creates a new TracerProvider with service-specific Resource if not exists.
   *
   * @param serviceName - The Moleculer service name (e.g., 'v1.users', 'v1.auth')
   * @returns Tracer instance for the service
   */
  getTracer(serviceName: string): Tracer {
    let provider = this.providers.get(serviceName);

    if (!provider) {
      provider = this.createProvider(serviceName);
      this.providers.set(serviceName, provider);

      if (this.logging) {
        console.log(`[OTEL] Created TracerProvider for service: ${serviceName}`);
      }
    }

    return provider.getTracer(TRACER_NAME);
  }

  /**
   * Creates a new TracerProvider with service-specific Resource
   */
  private createProvider(serviceName: string): NodeTracerProvider {
    const resource = new Resource({
      'service.name': serviceName,
      ...this.baseAttributes,
    });

    const provider = new NodeTracerProvider({
      resource,
    });

    // Add span processor with shared exporter
    const processor = this.useBatch
      ? new BatchSpanProcessor(this.exporter, {
          maxQueueSize: this.batchOptions.maxQueueSize ?? 2048,
          maxExportBatchSize: this.batchOptions.maxExportBatchSize ?? 512,
          scheduledDelayMillis: this.batchOptions.scheduledDelayMillis ?? 5000,
          exportTimeoutMillis: this.batchOptions.exportTimeoutMillis ?? 30000,
        })
      : new SimpleSpanProcessor(this.exporter);

    provider.addSpanProcessor(processor);

    // Only register the first provider globally for context propagation
    // Subsequent providers are used directly without global registration
    if (this.isFirstProvider) {
      provider.register();
      this.isFirstProvider = false;
    }

    return provider;
  }

  /**
   * Get all registered service names
   */
  getServiceNames(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Check if a service provider exists
   */
  hasService(serviceName: string): boolean {
    return this.providers.has(serviceName);
  }

  /**
   * Shutdown all providers and flush pending spans
   */
  async shutdown(): Promise<void> {
    if (this.logging) {
      console.log(`[OTEL] Shutting down ${this.providers.size} TracerProviders...`);
    }

    const shutdownPromises = Array.from(this.providers.values()).map(provider =>
      provider.shutdown().catch(err => {
        console.error('[OTEL] Error shutting down provider:', err);
      })
    );

    await Promise.all(shutdownPromises);
    this.providers.clear();

    if (this.logging) {
      console.log('[OTEL] All TracerProviders shut down successfully');
    }
  }

  /**
   * Force flush all pending spans
   */
  async forceFlush(): Promise<void> {
    const flushPromises = Array.from(this.providers.values()).map(provider =>
      provider.forceFlush().catch(err => {
        console.error('[OTEL] Error flushing provider:', err);
      })
    );

    await Promise.all(flushPromises);
  }
}

/**
 * Initialize the TracerProviderRegistry for multi-service mode.
 * Call this instead of initOTel() when you want each Moleculer service
 * to appear as a separate service in Jaeger.
 *
 * @example
 * ```typescript
 * import { initTracerRegistry, createOTelMiddleware } from 'moleculer-otel';
 *
 * // Initialize multi-service registry
 * initTracerRegistry({
 *   endpoint: 'http://localhost:4318/v1/traces',
 *   resourceAttributes: {
 *     'deployment.environment': 'production',
 *   },
 * });
 *
 * const broker = new ServiceBroker({
 *   middlewares: [
 *     createOTelMiddleware({ multiServiceMode: true }),
 *   ],
 * });
 * ```
 *
 * @param options - Registry initialization options
 * @returns The TracerProviderRegistry instance
 */
export function initTracerRegistry(options: RegistryOptions = {}): TracerProviderRegistry {
  if (registryInstance) {
    if (options.logging !== false) {
      console.log('[OTEL] TracerProviderRegistry already initialized, returning existing instance');
    }
    return registryInstance;
  }

  registryInstance = new TracerProviderRegistry(options);

  // Graceful shutdown
  const shutdown = async () => {
    try {
      await registryInstance?.shutdown();
    } catch (err) {
      console.error('[OTEL] Error during registry shutdown:', err);
    }
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  return registryInstance;
}

/**
 * Get the current TracerProviderRegistry instance, if initialized.
 */
export function getTracerRegistry(): TracerProviderRegistry | null {
  return registryInstance;
}

/**
 * Manually shutdown the TracerProviderRegistry.
 */
export async function shutdownTracerRegistry(): Promise<void> {
  if (registryInstance) {
    await registryInstance.shutdown();
    registryInstance = null;
  }
}
