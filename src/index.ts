import { trace } from '@opentelemetry/api';
import type { MoleculerOTelOptions } from './config/options';
import type { MoleculerMiddleware } from './types';
import { createMiddleware } from './middleware';
import { resolveOptions } from './config/defaults';

// Re-export types
export * from './types';
export * from './config/options';

// Re-export SDK initialization
export { initOTel, getOTelSDK, shutdownOTel } from './sdk/init';
export type {
  OTelInitOptions,
  BatchProcessorOptions,
  SamplingOptions,
  SamplingStrategy,
} from './sdk/init';

// Re-export multi-service mode (TracerProviderRegistry)
export {
  initTracerRegistry,
  getTracerRegistry,
  shutdownTracerRegistry,
  TracerProviderRegistry,
} from './sdk/tracer-registry';
export type { RegistryOptions } from './sdk/tracer-registry';

// Re-export utilities for advanced usage
export {
  injectContext,
  extractContext,
  hasTraceContext,
  getBaggage,
  getBaggageValue,
  withBaggage,
  getAllBaggage,
} from './propagation';
export { shouldExclude } from './utils/pattern-matcher';

// Re-export metrics utilities
export { getMetrics, resetMetrics, MoleculerMetrics } from './metrics';
export type { MetricsOptions } from './metrics';

// Re-export logging utilities for trace-log correlation
export {
  getTraceLogContext,
  createLogBindings,
  wrapLogFunction,
  createTracingLoggerMiddleware,
} from './logging/trace-context';
export type { TraceLogContext } from './logging/trace-context';
export {
  sanitizeAttributeValue,
  truncateValue,
  flattenObject,
  pickKeys,
} from './utils/attribute-sanitizer';

/**
 * Creates the OpenTelemetry middleware for Moleculer.
 *
 * This middleware integrates OpenTelemetry distributed tracing into Moleculer
 * microservices. It automatically traces actions and events, propagating
 * context across service boundaries.
 *
 * @example
 * ```typescript
 * // First, set up OpenTelemetry SDK (must be done before importing Moleculer)
 * import { NodeSDK } from '@opentelemetry/sdk-node';
 * import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
 *
 * const sdk = new NodeSDK({
 *   serviceName: 'my-service',
 *   traceExporter: new OTLPTraceExporter({
 *     url: 'http://localhost:4318/v1/traces',
 *   }),
 * });
 * sdk.start();
 *
 * // Then configure Moleculer with the middleware
 * import { ServiceBroker } from 'moleculer';
 * import { createOTelMiddleware } from 'moleculer-otel';
 *
 * const broker = new ServiceBroker({
 *   middlewares: [
 *     createOTelMiddleware({
 *       traceActions: true,
 *       traceEvents: true,
 *       actionParams: ['id', 'userId'],
 *       excludeActions: ['$node.*'],
 *     }),
 *   ],
 * });
 * ```
 *
 * @param options - Configuration options for the middleware
 * @returns Moleculer middleware object
 */
export function createOTelMiddleware(
  options: MoleculerOTelOptions = {}
): MoleculerMiddleware {
  const resolvedOptions = resolveOptions(options);
  return createMiddleware(resolvedOptions);
}

/**
 * Get the tracer instance for manual span creation.
 * Uses the same tracer name as the middleware for consistency.
 *
 * @example
 * ```typescript
 * import { getTracer } from 'moleculer-otel';
 *
 * const tracer = getTracer();
 * const span = tracer.startSpan('my-custom-operation');
 * try {
 *   // Do work
 * } finally {
 *   span.end();
 * }
 * ```
 *
 * @param name - Optional tracer name (defaults to 'moleculer-otel')
 * @returns OpenTelemetry Tracer instance
 */
export function getTracer(name = 'moleculer-otel') {
  return trace.getTracer(name);
}

// Default export for convenience
export default createOTelMiddleware;
