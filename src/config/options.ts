import type { TextMapPropagator } from '@opentelemetry/api';
import type {
  OnSpanStartCallback,
  OnSpanEndCallback,
  ErrorFilterCallback,
  AttributeExtractor,
} from '../types';
import type { MetricsOptions } from '../metrics';

/**
 * Configuration options for the OpenTelemetry middleware
 */
export interface MoleculerOTelOptions {
  /**
   * Service name for OpenTelemetry resource.
   * If not provided, uses Moleculer's nodeID.
   */
  serviceName?: string;

  /**
   * Whether to enable tracing for actions.
   * @default true
   */
  traceActions?: boolean;

  /**
   * Whether to enable tracing for events.
   * @default true
   */
  traceEvents?: boolean;

  /**
   * Configure which action parameters to include in span attributes.
   * - true: include all params
   * - false: exclude all params
   * - string[]: include only specified param keys
   * - function: custom filter function
   * @default true
   */
  actionParams?: boolean | string[] | AttributeExtractor<unknown>;

  /**
   * Configure which metadata fields to include in span attributes.
   * @default false
   */
  actionMeta?: boolean | string[] | AttributeExtractor<Record<string, unknown>>;

  /**
   * Configure which response fields to include in span attributes.
   * @default false
   */
  actionResponse?: boolean | string[] | AttributeExtractor<unknown>;

  /**
   * Configure event payload inclusion in span attributes.
   * @default false
   */
  eventPayload?: boolean | string[] | AttributeExtractor<unknown>;

  /**
   * Custom text map propagator.
   * @default W3CTraceContextPropagator
   */
  propagator?: TextMapPropagator;

  /**
   * Meta key used for trace context propagation.
   * @default '$otel'
   */
  metaKey?: string;

  /**
   * Actions to exclude from tracing (glob patterns supported).
   * @example ['$node.*', 'internal.*']
   */
  excludeActions?: string[];

  /**
   * Events to exclude from tracing (glob patterns supported).
   */
  excludeEvents?: string[];

  /**
   * Maximum attribute value length before truncation.
   * @default 1024
   */
  maxAttributeValueLength?: number;

  /**
   * Custom error filter - return false to skip error recording.
   */
  errorFilter?: ErrorFilterCallback;

  /**
   * Hook called when span is started.
   * Allows adding custom attributes.
   */
  onSpanStart?: OnSpanStartCallback;

  /**
   * Hook called before span is ended.
   * Allows adding custom attributes based on result.
   */
  onSpanEnd?: OnSpanEndCallback;

  /**
   * Enable OpenTelemetry metrics collection.
   * Records action duration, call count, error count, and event count.
   *
   * @example
   * ```typescript
   * createOTelMiddleware({
   *   metrics: {
   *     enabled: true,
   *     prefix: 'myapp',  // Custom prefix for metric names
   *   },
   * });
   * ```
   */
  metrics?: MetricsOptions;

  /**
   * When enabled, sets `service.name` span attribute to the Moleculer service name.
   * This allows different Moleculer services to appear separately in tracing backends
   * like Jaeger that support span-level service identification.
   *
   * Note: `moleculer.service` attribute is always added regardless of this setting.
   *
   * @default false
   */
  perServiceTracing?: boolean;

  /**
   * Enable multi-service mode with separate TracerProviders per Moleculer service.
   * Each Moleculer service will appear as a distinct service in Jaeger's service dropdown.
   *
   * Requires `initTracerRegistry()` to be called instead of `initOTel()`.
   *
   * @example
   * ```typescript
   * import { initTracerRegistry, createOTelMiddleware } from 'moleculer-otel';
   *
   * initTracerRegistry({
   *   endpoint: 'http://localhost:4318/v1/traces',
   * });
   *
   * const broker = new ServiceBroker({
   *   middlewares: [
   *     createOTelMiddleware({ multiServiceMode: true }),
   *   ],
   * });
   * ```
   *
   * @default false
   */
  multiServiceMode?: boolean;
}

/**
 * Internal resolved options with all defaults applied
 */
export interface ResolvedOptions extends Required<Omit<MoleculerOTelOptions,
  'serviceName' | 'propagator' | 'errorFilter' | 'onSpanStart' | 'onSpanEnd' | 'metrics' | 'perServiceTracing' | 'multiServiceMode'>> {
  serviceName?: string;
  propagator?: TextMapPropagator;
  errorFilter?: ErrorFilterCallback;
  onSpanStart?: OnSpanStartCallback;
  onSpanEnd?: OnSpanEndCallback;
  metrics?: MetricsOptions;
  perServiceTracing: boolean;
  multiServiceMode: boolean;
}
