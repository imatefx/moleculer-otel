import { trace, context } from '@opentelemetry/api';

/**
 * Trace context information for log correlation
 */
export interface TraceLogContext {
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
export function getTraceLogContext(): TraceLogContext | undefined {
  const span = trace.getSpan(context.active());
  if (!span) {
    return undefined;
  }

  const spanContext = span.spanContext();
  if (!spanContext || !spanContext.traceId) {
    return undefined;
  }

  return {
    traceId: spanContext.traceId,
    spanId: spanContext.spanId,
    sampled: (spanContext.traceFlags & 1) === 1,
  };
}

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
export function createLogBindings(prefix?: string): Record<string, string | boolean> {
  const ctx = getTraceLogContext();
  if (!ctx) {
    return {};
  }

  const p = prefix ? `${prefix}.` : '';

  return {
    [`${p}traceId`]: ctx.traceId,
    [`${p}spanId`]: ctx.spanId,
    [`${p}sampled`]: ctx.sampled,
  };
}

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
export function wrapLogFunction<T extends (...args: unknown[]) => void>(
  logFn: T,
  options?: { includeSpanId?: boolean }
): T {
  return ((...args: unknown[]) => {
    const ctx = getTraceLogContext();
    if (ctx) {
      const prefix = options?.includeSpanId
        ? `[traceId=${ctx.traceId} spanId=${ctx.spanId}]`
        : `[traceId=${ctx.traceId}]`;
      if (typeof args[0] === 'string') {
        args[0] = `${prefix} ${args[0]}`;
      } else {
        args.unshift(prefix);
      }
    }
    return logFn(...args);
  }) as T;
}

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
export function createTracingLoggerMiddleware() {
  return {
    name: 'TracingLoggerMiddleware',

    // Hook into broker created to wrap logger methods
    created(broker: { logger: Record<string, (...args: unknown[]) => void> }) {
      const logger = broker.logger;
      const methods = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const;

      for (const method of methods) {
        if (typeof logger[method] === 'function') {
          const original = logger[method].bind(logger);
          logger[method] = wrapLogFunction(original);
        }
      }
    },
  };
}
