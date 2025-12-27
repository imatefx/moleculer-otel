import { trace, context, SpanKind, Tracer } from '@opentelemetry/api';
import type {
  MoleculerContext,
  EventSchema,
  EmitOptions,
  ServiceBroker,
} from '../types';
import type { ResolvedOptions } from '../config/options';
import { injectContext, extractContext, getActiveContext } from '../propagation';
import { buildEventAttributes } from '../tracing/span-attributes';
import { recordError, recordSuccess } from '../tracing/error-handler';
import { shouldExclude } from '../utils/pattern-matcher';
import { getMetrics, MoleculerMetrics } from '../metrics';
import { getTracerRegistry, TracerProviderRegistry } from '../sdk/tracer-registry';

const TRACER_NAME = 'moleculer-otel';

/**
 * Get the appropriate tracer based on service name and configuration.
 * In multi-service mode, returns a service-specific tracer from the registry.
 * Otherwise, returns the global tracer.
 */
function getTracerForService(
  serviceName: string,
  registry: TracerProviderRegistry | null,
  useMultiService: boolean
): Tracer {
  if (useMultiService && registry) {
    return registry.getTracer(serviceName);
  }
  return trace.getTracer(TRACER_NAME);
}

export interface EventMiddlewareHandlers {
  emit: (
    next: (eventName: string, payload: unknown, opts: EmitOptions) => Promise<void>
  ) => (eventName: string, payload: unknown, opts: EmitOptions) => Promise<void>;
  broadcast: (
    next: (eventName: string, payload: unknown, opts: EmitOptions) => Promise<void>
  ) => (eventName: string, payload: unknown, opts: EmitOptions) => Promise<void>;
  localEvent: (
    next: (ctx: MoleculerContext) => Promise<void>,
    event: EventSchema
  ) => (ctx: MoleculerContext) => Promise<void>;
}

/**
 * Creates event middleware handlers for tracing.
 */
export function createEventMiddleware(
  options: ResolvedOptions
): EventMiddlewareHandlers {
  const metaKey = options.metaKey;

  // Get registry for multi-service mode
  const registry = getTracerRegistry();
  const useMultiService = options.multiServiceMode && registry !== null;

  // Initialize metrics if enabled
  let metricsCollector: MoleculerMetrics | null = null;
  if (options.metrics?.enabled) {
    metricsCollector = getMetrics(options.metrics);
  }

  /**
   * Wraps broker.emit to trace outgoing events.
   */
  function emit(
    next: (eventName: string, payload: unknown, opts: EmitOptions) => Promise<void>
  ) {
    return function (
      this: ServiceBroker,
      eventName: string,
      payload: unknown,
      opts: EmitOptions = {}
    ): Promise<void> {
      // Skip excluded events
      if (shouldExclude(eventName, options.excludeEvents)) {
        return next.call(this, eventName, payload, opts);
      }

      const parentContext = getActiveContext();

      // Extract service name from event (events are often namespaced like 'users.created')
      const eventServiceName = eventName.split('.')[0];

      // Get service-specific tracer in multi-service mode
      const tracer = getTracerForService(eventServiceName, registry, useMultiService);

      const span = tracer.startSpan(
        `emit:${eventName}`,
        {
          kind: SpanKind.PRODUCER,
          attributes: {
            'messaging.system': 'moleculer',
            'messaging.operation': 'emit',
            'messaging.destination.name': eventName,
            'moleculer.event': eventName,
            'moleculer.event.type': 'emit',
            'moleculer.service': eventServiceName,
            ...(options.perServiceTracing && { 'service.name': eventServiceName }),
          },
        },
        parentContext
      );

      // Inject trace context into meta
      const carrier: Record<string, string> = {};
      const spanContext = trace.setSpan(parentContext, span);
      injectContext(spanContext, carrier);

      const enhancedOpts: EmitOptions = {
        ...opts,
        meta: {
          ...opts.meta,
          [metaKey]: carrier,
        },
      };

      return context.with(spanContext, async () => {
        try {
          await next.call(this, eventName, payload, enhancedOpts);
          recordSuccess(span);
          // Record event emit metric
          if (metricsCollector) {
            metricsCollector.recordEvent(eventName, 'emit');
          }
        } catch (error) {
          recordError(span, error as Error, null, options);
          throw error;
        } finally {
          span.end();
        }
      });
    };
  }

  /**
   * Wraps broker.broadcast to trace broadcast events.
   */
  function broadcast(
    next: (eventName: string, payload: unknown, opts: EmitOptions) => Promise<void>
  ) {
    return function (
      this: ServiceBroker,
      eventName: string,
      payload: unknown,
      opts: EmitOptions = {}
    ): Promise<void> {
      // Skip excluded events
      if (shouldExclude(eventName, options.excludeEvents)) {
        return next.call(this, eventName, payload, opts);
      }

      const parentContext = getActiveContext();

      // Extract service name from event (events are often namespaced like 'users.created')
      const broadcastServiceName = eventName.split('.')[0];

      // Get service-specific tracer in multi-service mode
      const tracer = getTracerForService(broadcastServiceName, registry, useMultiService);

      const span = tracer.startSpan(
        `broadcast:${eventName}`,
        {
          kind: SpanKind.PRODUCER,
          attributes: {
            'messaging.system': 'moleculer',
            'messaging.operation': 'broadcast',
            'messaging.destination.name': eventName,
            'moleculer.event': eventName,
            'moleculer.event.type': 'broadcast',
            'moleculer.service': broadcastServiceName,
            ...(options.perServiceTracing && { 'service.name': broadcastServiceName }),
          },
        },
        parentContext
      );

      // Inject trace context into meta
      const carrier: Record<string, string> = {};
      const spanContext = trace.setSpan(parentContext, span);
      injectContext(spanContext, carrier);

      const enhancedOpts: EmitOptions = {
        ...opts,
        meta: {
          ...opts.meta,
          [metaKey]: carrier,
        },
      };

      return context.with(spanContext, async () => {
        try {
          await next.call(this, eventName, payload, enhancedOpts);
          recordSuccess(span);
          // Record event broadcast metric
          if (metricsCollector) {
            metricsCollector.recordEvent(eventName, 'broadcast');
          }
        } catch (error) {
          recordError(span, error as Error, null, options);
          throw error;
        } finally {
          span.end();
        }
      });
    };
  }

  /**
   * Wraps local event handlers to trace event consumption.
   */
  function localEvent(
    next: (ctx: MoleculerContext) => Promise<void>,
    event: EventSchema
  ) {
    return function (ctx: MoleculerContext): Promise<void> {
      const eventName = ctx.eventName || event.name;

      // Skip excluded events
      if (shouldExclude(eventName, options.excludeEvents)) {
        return next(ctx);
      }

      // Extract trace context from meta
      const carrier = (ctx.meta?.[metaKey] as Record<string, string>) || {};
      const parentContext = extractContext(getActiveContext(), carrier);

      // Get service name from the handler's service context
      const handlerServiceName = ctx.service?.name || eventName.split('.')[0];

      // Get service-specific tracer in multi-service mode
      const tracer = getTracerForService(handlerServiceName, registry, useMultiService);

      const span = tracer.startSpan(
        `handle:${eventName}`,
        {
          kind: SpanKind.CONSUMER,
          attributes: buildEventAttributes(ctx, eventName, options),
        },
        parentContext
      );

      // Call onSpanStart hook if provided
      if (options.onSpanStart) {
        try {
          options.onSpanStart(span, ctx, 'event');
        } catch {
          // Ignore hook errors
        }
      }

      const spanContext = trace.setSpan(parentContext, span);

      return context.with(spanContext, async () => {
        try {
          await next(ctx);
          recordSuccess(span);

          // Call onSpanEnd hook if provided
          if (options.onSpanEnd) {
            try {
              options.onSpanEnd(span, ctx, undefined, 'event');
            } catch {
              // Ignore hook errors
            }
          }
        } catch (error) {
          recordError(span, error as Error, ctx, options);
          throw error;
        } finally {
          span.end();
        }
      });
    };
  }

  return { emit, broadcast, localEvent };
}
