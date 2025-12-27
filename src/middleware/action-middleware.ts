import { trace, context, SpanKind } from '@opentelemetry/api';
import type { Readable } from 'stream';
import type {
  MoleculerContext,
  ActionSchema,
  CallOptions,
  ServiceBroker,
} from '../types';
import type { ResolvedOptions } from '../config/options';
import { injectContext, extractContext, getActiveContext } from '../propagation';
import { buildActionAttributes, buildResponseAttributes } from '../tracing/span-attributes';
import { recordError, recordSuccess } from '../tracing/error-handler';
import { shouldExclude } from '../utils/pattern-matcher';
import { getMetrics, MoleculerMetrics } from '../metrics';

const TRACER_NAME = 'moleculer-otel';

/**
 * Check if a value is a Node.js stream
 */
function isStream(value: unknown): value is Readable {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof (value as Readable).pipe === 'function'
  );
}

export interface ActionMiddlewareHandlers {
  call: (
    next: (actionName: string, params: unknown, opts: CallOptions) => Promise<unknown>
  ) => (actionName: string, params: unknown, opts: CallOptions) => Promise<unknown>;
  localAction: (
    next: (ctx: MoleculerContext) => Promise<unknown>,
    action: ActionSchema
  ) => (ctx: MoleculerContext) => Promise<unknown>;
  remoteAction: (
    next: (ctx: MoleculerContext) => Promise<unknown>,
    action: ActionSchema
  ) => (ctx: MoleculerContext) => Promise<unknown>;
}

/**
 * Creates action middleware handlers for tracing.
 */
export function createActionMiddleware(
  options: ResolvedOptions
): ActionMiddlewareHandlers {
  const tracer = trace.getTracer(TRACER_NAME);
  const metaKey = options.metaKey;

  // Initialize metrics if enabled
  let metricsCollector: MoleculerMetrics | null = null;
  if (options.metrics?.enabled) {
    metricsCollector = getMetrics(options.metrics);
  }

  /**
   * Wraps outgoing action calls to inject trace context.
   * This ensures context is propagated to remote services.
   */
  function call(
    next: (actionName: string, params: unknown, opts: CallOptions) => Promise<unknown>
  ) {
    return function (
      this: ServiceBroker,
      actionName: string,
      params: unknown,
      opts: CallOptions = {}
    ): Promise<unknown> {
      // Skip excluded actions
      if (shouldExclude(actionName, options.excludeActions)) {
        return next.call(this, actionName, params, opts);
      }

      const parentContext = getActiveContext();
      const serviceName = actionName.split('.')[0];

      // Detect streaming
      const isStreamingRequest = isStream(params);

      const span = tracer.startSpan(
        `call ${actionName}`,
        {
          kind: SpanKind.CLIENT,
          attributes: {
            'rpc.system': 'moleculer',
            'rpc.service': serviceName,
            'rpc.method': actionName,
            'moleculer.action': actionName,
            ...(this?.nodeID && { 'moleculer.caller': this.nodeID }),
            ...(isStreamingRequest && { 'moleculer.streaming': true }),
          },
        },
        parentContext
      );

      // Inject trace context into meta
      const carrier: Record<string, string> = {};
      const spanContext = trace.setSpan(parentContext, span);
      injectContext(spanContext, carrier);

      const enhancedOpts: CallOptions = {
        ...opts,
        meta: {
          ...opts.meta,
          [metaKey]: carrier,
        },
      };

      return context.with(spanContext, async () => {
        try {
          const result = await next.call(this, actionName, params, enhancedOpts);
          recordSuccess(span);
          return result;
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
   * Wraps local action execution.
   * Extracts trace context from incoming request and creates server span.
   */
  function localAction(
    next: (ctx: MoleculerContext) => Promise<unknown>,
    action: ActionSchema
  ) {
    return function (ctx: MoleculerContext): Promise<unknown> {
      const actionName = action.name;

      // Skip excluded actions
      if (shouldExclude(actionName, options.excludeActions)) {
        return next(ctx);
      }

      // Extract trace context from meta
      const carrier = (ctx.meta?.[metaKey] as Record<string, string>) || {};
      const parentContext = extractContext(getActiveContext(), carrier);

      // Detect streaming request
      const isStreamingRequest = isStream(ctx.params);

      const baseAttributes = buildActionAttributes(ctx, action, options);
      if (isStreamingRequest) {
        baseAttributes['moleculer.streaming'] = true;
        baseAttributes['moleculer.streaming.direction'] = 'request';
      }

      const span = tracer.startSpan(
        actionName,
        {
          kind: SpanKind.SERVER,
          attributes: baseAttributes,
        },
        parentContext
      );

      // Call onSpanStart hook if provided
      if (options.onSpanStart) {
        try {
          options.onSpanStart(span, ctx, 'action');
        } catch {
          // Ignore hook errors
        }
      }

      const spanContext = trace.setSpan(parentContext, span);

      // Track start time for metrics
      const startTime = metricsCollector ? Date.now() : 0;

      return context.with(spanContext, async () => {
        try {
          const result = await next(ctx);

          // Detect streaming response
          const isStreamingResponse = isStream(result);

          if (isStreamingResponse) {
            span.setAttribute('moleculer.streaming.response', true);
            // For streaming responses, we end the span when stream ends
            const stream = result as Readable;

            stream.once('end', () => {
              recordSuccess(span);
              // Record metrics for streaming response
              if (metricsCollector) {
                const durationMs = Date.now() - startTime;
                metricsCollector.recordAction(actionName, durationMs, true);
              }
              if (options.onSpanEnd) {
                try {
                  options.onSpanEnd(span, ctx, result, 'action');
                } catch {
                  // Ignore hook errors
                }
              }
              span.end();
            });

            stream.once('error', (error: Error) => {
              recordError(span, error, ctx, options);
              // Record metrics for streaming error
              if (metricsCollector) {
                const durationMs = Date.now() - startTime;
                metricsCollector.recordAction(actionName, durationMs, false);
              }
              span.end();
            });

            return result;
          }

          recordSuccess(span);

          // Record metrics for successful action
          if (metricsCollector) {
            const durationMs = Date.now() - startTime;
            metricsCollector.recordAction(actionName, durationMs, true);
          }

          // Add response attributes if configured (skip for streams)
          if (options.actionResponse && result) {
            const responseAttrs = buildResponseAttributes(
              result,
              options.actionResponse,
              ctx,
              options.maxAttributeValueLength
            );
            span.setAttributes(responseAttrs);
          }

          // Call onSpanEnd hook if provided
          if (options.onSpanEnd) {
            try {
              options.onSpanEnd(span, ctx, result, 'action');
            } catch {
              // Ignore hook errors
            }
          }

          span.end();
          return result;
        } catch (error) {
          recordError(span, error as Error, ctx, options);
          // Record metrics for failed action
          if (metricsCollector) {
            const durationMs = Date.now() - startTime;
            metricsCollector.recordAction(actionName, durationMs, false);
          }
          span.end();
          throw error;
        }
      });
    };
  }

  /**
   * Wraps remote action execution.
   * Similar to localAction but for actions executing on remote nodes.
   */
  function remoteAction(
    next: (ctx: MoleculerContext) => Promise<unknown>,
    action: ActionSchema
  ) {
    return function (ctx: MoleculerContext): Promise<unknown> {
      const actionName = action.name;

      // Skip excluded actions
      if (shouldExclude(actionName, options.excludeActions)) {
        return next(ctx);
      }

      // Extract trace context from meta
      const carrier = (ctx.meta?.[metaKey] as Record<string, string>) || {};
      const parentContext = extractContext(getActiveContext(), carrier);

      const span = tracer.startSpan(
        `remote:${actionName}`,
        {
          kind: SpanKind.CLIENT,
          attributes: {
            'rpc.system': 'moleculer',
            'rpc.service': actionName.split('.')[0],
            'rpc.method': actionName,
            'moleculer.action': actionName,
            'moleculer.remote': true,
            'moleculer.nodeID': ctx.nodeID,
          },
        },
        parentContext
      );

      const spanContext = trace.setSpan(parentContext, span);

      return context.with(spanContext, async () => {
        try {
          const result = await next(ctx);
          recordSuccess(span);
          return result;
        } catch (error) {
          recordError(span, error as Error, ctx, options);
          throw error;
        } finally {
          span.end();
        }
      });
    };
  }

  return { call, localAction, remoteAction };
}
