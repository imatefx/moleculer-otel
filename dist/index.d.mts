import * as _opentelemetry_api from '@opentelemetry/api';
import { Span, Attributes, TextMapPropagator, Context, Baggage, BaggageEntry, AttributeValue } from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';

/**
 * Moleculer Context type (simplified for middleware use)
 */
interface MoleculerContext {
    id: string;
    requestID: string;
    nodeID: string;
    caller: string | null;
    level: number;
    params: unknown;
    meta: Record<string, unknown>;
    service?: {
        name: string;
        version?: string;
    };
    action?: {
        name: string;
    };
    eventName?: string;
    eventType?: string;
    eventGroups?: string[];
    options?: {
        timeout?: number;
        retries?: number;
        [key: string]: unknown;
    };
    _retryAttempts?: number;
    cachedResult?: boolean;
    call: (actionName: string, params?: unknown, opts?: CallOptions) => Promise<unknown>;
    emit: (eventName: string, payload?: unknown, opts?: EmitOptions) => Promise<void>;
    broadcast: (eventName: string, payload?: unknown, opts?: EmitOptions) => Promise<void>;
}
/**
 * Call options for action invocations
 */
interface CallOptions {
    timeout?: number;
    retries?: number;
    meta?: Record<string, unknown>;
    nodeID?: string;
    [key: string]: unknown;
}
/**
 * Emit options for events
 */
interface EmitOptions {
    groups?: string[];
    meta?: Record<string, unknown>;
    [key: string]: unknown;
}
/**
 * Action schema definition
 */
interface ActionSchema {
    name: string;
    rawName?: string;
    handler?: (ctx: MoleculerContext) => Promise<unknown>;
    params?: Record<string, unknown>;
    [key: string]: unknown;
}
/**
 * Event schema definition
 */
interface EventSchema {
    name: string;
    group?: string;
    handler?: (ctx: MoleculerContext) => Promise<void>;
    [key: string]: unknown;
}
/**
 * Service broker interface (simplified)
 */
interface ServiceBroker {
    nodeID: string;
    Promise: PromiseConstructor;
    logger: unknown;
    call: (actionName: string, params?: unknown, opts?: CallOptions) => Promise<unknown>;
    emit: (eventName: string, payload?: unknown, opts?: EmitOptions) => Promise<void>;
    broadcast: (eventName: string, payload?: unknown, opts?: EmitOptions) => Promise<void>;
}
/**
 * Moleculer middleware interface
 */
interface MoleculerMiddleware {
    name: string;
    created?: (broker: ServiceBroker) => void;
    started?: (broker: ServiceBroker) => Promise<void>;
    stopped?: (broker: ServiceBroker) => Promise<void>;
    localAction?: (next: (ctx: MoleculerContext) => Promise<unknown>, action: ActionSchema) => (ctx: MoleculerContext) => Promise<unknown>;
    remoteAction?: (next: (ctx: MoleculerContext) => Promise<unknown>, action: ActionSchema) => (ctx: MoleculerContext) => Promise<unknown>;
    call?: (next: (actionName: string, params: unknown, opts: CallOptions) => Promise<unknown>) => (actionName: string, params: unknown, opts: CallOptions) => Promise<unknown>;
    emit?: (next: (eventName: string, payload: unknown, opts: EmitOptions) => Promise<void>) => (eventName: string, payload: unknown, opts: EmitOptions) => Promise<void>;
    broadcast?: (next: (eventName: string, payload: unknown, opts: EmitOptions) => Promise<void>) => (eventName: string, payload: unknown, opts: EmitOptions) => Promise<void>;
    localEvent?: (next: (ctx: MoleculerContext) => Promise<void>, event: EventSchema) => (ctx: MoleculerContext) => Promise<void>;
    [key: string]: unknown;
}
/**
 * Span type for hooks
 */
type SpanType = 'action' | 'event';
/**
 * Callback for span start hook
 */
type OnSpanStartCallback = (span: Span, ctx: MoleculerContext, type: SpanType) => void;
/**
 * Callback for span end hook
 */
type OnSpanEndCallback = (span: Span, ctx: MoleculerContext, result: unknown, type: SpanType) => void;
/**
 * Error filter callback
 */
type ErrorFilterCallback = (error: Error, ctx: MoleculerContext) => boolean;
/**
 * Attribute extractor function type
 */
type AttributeExtractor<T> = (data: T, ctx: MoleculerContext) => Record<string, unknown>;

/**
 * Metrics configuration options
 */
interface MetricsOptions {
    /** Enable metrics collection (default: false) */
    enabled?: boolean;
    /** Histogram buckets for action duration in milliseconds */
    durationBuckets?: number[];
    /** Prefix for metric names (default: 'moleculer') */
    prefix?: string;
}
/**
 * Moleculer metrics collector using OpenTelemetry Metrics API
 */
declare class MoleculerMetrics {
    private actionDuration;
    private actionCalls;
    private actionErrors;
    private eventEmits;
    private prefix;
    constructor(options?: MetricsOptions);
    /**
     * Record an action call with duration
     */
    recordAction(actionName: string, durationMs: number, success: boolean, attributes?: Attributes): void;
    /**
     * Record an event emission
     */
    recordEvent(eventName: string, type: 'emit' | 'broadcast', attributes?: Attributes): void;
}
/**
 * Gets or creates the metrics singleton
 */
declare function getMetrics(options?: MetricsOptions): MoleculerMetrics;
/**
 * Resets the metrics instance (useful for testing)
 */
declare function resetMetrics(): void;

/**
 * Configuration options for the OpenTelemetry middleware
 */
interface MoleculerOTelOptions {
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
}
/**
 * Internal resolved options with all defaults applied
 */
interface ResolvedOptions extends Required<Omit<MoleculerOTelOptions, 'serviceName' | 'propagator' | 'errorFilter' | 'onSpanStart' | 'onSpanEnd' | 'metrics' | 'perServiceTracing'>> {
    serviceName?: string;
    propagator?: TextMapPropagator;
    errorFilter?: ErrorFilterCallback;
    onSpanStart?: OnSpanStartCallback;
    onSpanEnd?: OnSpanEndCallback;
    metrics?: MetricsOptions;
    perServiceTracing: boolean;
}

/**
 * Batch processor configuration options
 */
interface BatchProcessorOptions {
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
type SamplingStrategy = 'always_on' | 'always_off' | 'ratio' | 'parent_based';
/**
 * Sampling configuration options
 */
interface SamplingOptions {
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
interface OTelInitOptions {
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
declare function initOTel(options?: OTelInitOptions): NodeSDK;
/**
 * Get the current SDK instance, if initialized.
 */
declare function getOTelSDK(): NodeSDK | null;
/**
 * Manually shutdown the SDK.
 */
declare function shutdownOTel(): Promise<void>;

/**
 * Carrier type for Moleculer meta propagation.
 * Maps to traceparent and tracestate headers (W3C Trace Context).
 * Also includes baggage header for W3C Baggage propagation.
 */
interface TraceCarrier {
    traceparent?: string;
    tracestate?: string;
    baggage?: string;
}
/**
 * Injects the current trace context into a carrier object.
 * The carrier is then stored in Moleculer's ctx.meta for propagation.
 *
 * @param ctx - The OpenTelemetry context to inject
 * @param carrier - The carrier object to inject into
 */
declare function injectContext(ctx: Context, carrier: TraceCarrier): void;
/**
 * Extracts trace context from a carrier object.
 * Used when receiving requests from other services.
 *
 * @param ctx - The parent OpenTelemetry context
 * @param carrier - The carrier object containing trace headers
 * @returns The extracted context with trace information
 */
declare function extractContext(ctx: Context, carrier: TraceCarrier): Context;
/**
 * Checks if a carrier contains valid trace context.
 */
declare function hasTraceContext(carrier: TraceCarrier): boolean;
/**
 * Gets the current baggage from the active context.
 *
 * @example
 * ```typescript
 * import { getBaggage } from 'moleculer-otel';
 *
 * const baggage = getBaggage();
 * const tenantId = baggage?.getEntry('tenantId')?.value;
 * ```
 */
declare function getBaggage(): Baggage | undefined;
/**
 * Gets a specific baggage entry value from the current context.
 *
 * @example
 * ```typescript
 * import { getBaggageValue } from 'moleculer-otel';
 *
 * const tenantId = getBaggageValue('tenantId');
 * ```
 */
declare function getBaggageValue(key: string): string | undefined;
/**
 * Creates a new context with the specified baggage entries.
 *
 * @example
 * ```typescript
 * import { withBaggage, context } from 'moleculer-otel';
 *
 * const ctxWithBaggage = withBaggage({
 *   tenantId: 'tenant-123',
 *   userId: 'user-456',
 * });
 *
 * // Execute code within this context
 * context.with(ctxWithBaggage, () => {
 *   // Baggage will be propagated to downstream calls
 * });
 * ```
 */
declare function withBaggage(entries: Record<string, string | BaggageEntry>, parentContext?: Context): Context;
/**
 * Gets all baggage entries as a plain object.
 *
 * @example
 * ```typescript
 * import { getAllBaggage } from 'moleculer-otel';
 *
 * const entries = getAllBaggage();
 * // { tenantId: 'tenant-123', userId: 'user-456' }
 * ```
 */
declare function getAllBaggage(): Record<string, string>;

/**
 * Checks if a name matches any of the exclusion patterns.
 *
 * @param name - The action or event name to check
 * @param patterns - Array of glob patterns to match against
 * @returns true if the name should be excluded
 */
declare function shouldExclude(name: string, patterns?: string[]): boolean;

/**
 * Trace context information for log correlation
 */
interface TraceLogContext {
    /** The trace ID (32 hex characters) */
    traceId: string;
    /** The span ID (16 hex characters) */
    spanId: string;
    /** Whether the trace is being sampled */
    sampled: boolean;
}
/**
 * Gets the current trace context for log correlation.
 * Returns undefined if there's no active trace.
 *
 * @example
 * ```typescript
 * import { getTraceLogContext } from 'moleculer-otel';
 *
 * // In your action handler
 * const traceCtx = getTraceLogContext();
 * if (traceCtx) {
 *   logger.info('Processing request', {
 *     traceId: traceCtx.traceId,
 *     spanId: traceCtx.spanId,
 *   });
 * }
 * ```
 */
declare function getTraceLogContext(): TraceLogContext | undefined;
/**
 * Creates a log bindings object with trace context.
 * Useful for structured logging libraries like Pino or Winston.
 *
 * @example
 * ```typescript
 * import { createLogBindings } from 'moleculer-otel';
 *
 * // With Pino
 * const bindings = createLogBindings();
 * logger.info({ ...bindings }, 'Processing request');
 *
 * // With custom prefix
 * const bindings = createLogBindings('trace');
 * // Returns: { 'trace.id': '...', 'trace.spanId': '...' }
 * ```
 */
declare function createLogBindings(prefix?: string): Record<string, string | boolean>;
/**
 * Wraps a log function to automatically inject trace context.
 *
 * @example
 * ```typescript
 * import { wrapLogFunction } from 'moleculer-otel';
 *
 * const originalLog = console.log;
 * console.log = wrapLogFunction(originalLog);
 *
 * // Now logs will include trace context
 * console.log('Hello'); // [traceId=abc123] Hello
 * ```
 */
declare function wrapLogFunction<T extends (...args: unknown[]) => void>(logFn: T, options?: {
    includeSpanId?: boolean;
}): T;
/**
 * Creates a Moleculer logger middleware that injects trace context.
 * This can be used in the broker's logger configuration.
 *
 * @example
 * ```typescript
 * import { createTracingLoggerMiddleware } from 'moleculer-otel';
 *
 * const broker = new ServiceBroker({
 *   logger: {
 *     type: 'Console',
 *     options: {
 *       // Use custom formatter
 *     },
 *   },
 *   middlewares: [
 *     createTracingLoggerMiddleware(),
 *     createOTelMiddleware(),
 *   ],
 * });
 * ```
 */
declare function createTracingLoggerMiddleware(): {
    name: string;
    created(broker: {
        logger: Record<string, (...args: unknown[]) => void>;
    }): void;
};

/**
 * Sanitizes a value for use as an OpenTelemetry span attribute.
 * OTEL attributes support: string, number, boolean, or arrays of these.
 */
declare function sanitizeAttributeValue(value: unknown, maxLength?: number): AttributeValue | undefined;
/**
 * Truncates a string value to a maximum length.
 */
declare function truncateValue(value: string, maxLength: number): string;
/**
 * Flattens a nested object for span attributes using dot notation.
 */
declare function flattenObject(obj: Record<string, unknown>, maxLength?: number, prefix?: string, maxDepth?: number, currentDepth?: number): Record<string, AttributeValue>;
/**
 * Picks specific keys from an object (supports dot notation for nested access).
 */
declare function pickKeys(obj: Record<string, unknown>, keys: string[], maxLength?: number): Record<string, AttributeValue>;

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
declare function createOTelMiddleware(options?: MoleculerOTelOptions): MoleculerMiddleware;
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
declare function getTracer(name?: string): _opentelemetry_api.Tracer;

export { type ActionSchema, type AttributeExtractor, type BatchProcessorOptions, type CallOptions, type EmitOptions, type ErrorFilterCallback, type EventSchema, type MetricsOptions, type MoleculerContext, MoleculerMetrics, type MoleculerMiddleware, type MoleculerOTelOptions, type OTelInitOptions, type OnSpanEndCallback, type OnSpanStartCallback, type ResolvedOptions, type SamplingOptions, type SamplingStrategy, type ServiceBroker, type SpanType, type TraceLogContext, createLogBindings, createOTelMiddleware, createTracingLoggerMiddleware, createOTelMiddleware as default, extractContext, flattenObject, getAllBaggage, getBaggage, getBaggageValue, getMetrics, getOTelSDK, getTraceLogContext, getTracer, hasTraceContext, initOTel, injectContext, pickKeys, resetMetrics, sanitizeAttributeValue, shouldExclude, shutdownOTel, truncateValue, withBaggage, wrapLogFunction };
