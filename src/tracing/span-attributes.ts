import type { Attributes } from '@opentelemetry/api';
import type { MoleculerContext, ActionSchema } from '../types';
import type { ResolvedOptions } from '../config/options';
import {
  sanitizeAttributeValue,
  flattenObject,
  pickKeys,
} from '../utils/attribute-sanitizer';

/**
 * Builds span attributes for action invocations following OTEL semantic conventions.
 */
export function buildActionAttributes(
  ctx: MoleculerContext,
  action: ActionSchema,
  options: ResolvedOptions
): Attributes {
  const serviceName = action.name.split('.')[0];

  const attrs: Attributes = {
    // RPC semantic conventions
    'rpc.system': 'moleculer',
    'rpc.service': serviceName,
    'rpc.method': action.name,

    // Moleculer-specific attributes
    'moleculer.action': action.name,
    'moleculer.service': serviceName,
    'moleculer.nodeID': ctx.nodeID || 'local',
    'moleculer.requestID': ctx.requestID,
    'moleculer.level': ctx.level,
  };

  // Set service.name span attribute when perServiceTracing is enabled
  if (options.perServiceTracing) {
    attrs['service.name'] = serviceName;
  }

  if (ctx.caller) {
    attrs['moleculer.caller'] = ctx.caller;
  }

  // Add retry information if available
  if (ctx._retryAttempts !== undefined && ctx._retryAttempts > 0) {
    attrs['moleculer.retry.attempt'] = ctx._retryAttempts;
    attrs['moleculer.retry.isRetry'] = true;
  }

  // Add timeout information if configured
  if (ctx.options?.timeout) {
    attrs['moleculer.timeout'] = ctx.options.timeout;
  }

  // Add cache information if available
  if (ctx.cachedResult !== undefined) {
    attrs['moleculer.cache.hit'] = ctx.cachedResult;
  }

  // Check for cache key in meta (set by some cacher implementations)
  if (ctx.meta?.$cacheKey) {
    attrs['moleculer.cache.key'] = String(ctx.meta.$cacheKey).slice(0, 256);
  }

  // Add params if configured
  if (options.actionParams && ctx.params) {
    const paramAttrs = buildDataAttributes(
      ctx.params,
      options.actionParams,
      ctx,
      options.maxAttributeValueLength
    );
    Object.assign(attrs, prefixAttributes(paramAttrs, 'moleculer.params'));
  }

  // Add meta if configured
  if (options.actionMeta && ctx.meta) {
    // Filter out internal meta keys (starting with $)
    const filteredMeta = Object.fromEntries(
      Object.entries(ctx.meta).filter(([key]) => !key.startsWith('$'))
    );

    const metaAttrs = buildDataAttributes(
      filteredMeta,
      options.actionMeta as boolean | string[] | ((data: unknown, ctx: MoleculerContext) => Record<string, unknown>),
      ctx,
      options.maxAttributeValueLength
    );
    Object.assign(attrs, prefixAttributes(metaAttrs, 'moleculer.meta'));
  }

  return attrs;
}

/**
 * Builds span attributes for event handlers.
 */
export function buildEventAttributes(
  ctx: MoleculerContext,
  eventName: string,
  options: ResolvedOptions
): Attributes {
  // Extract service name from context or event name
  const serviceName = ctx.service?.name || eventName.split('.')[0];

  const attrs: Attributes = {
    // Messaging semantic conventions
    'messaging.system': 'moleculer',
    'messaging.operation': 'receive',
    'messaging.destination.name': eventName,

    // Moleculer-specific attributes
    'moleculer.event': eventName,
    'moleculer.service': serviceName,
    'moleculer.nodeID': ctx.nodeID || 'local',
    'moleculer.requestID': ctx.requestID,
  };

  // Set service.name span attribute when perServiceTracing is enabled
  if (options.perServiceTracing) {
    attrs['service.name'] = serviceName;
  }

  if (ctx.eventGroups && ctx.eventGroups.length > 0) {
    attrs['moleculer.event.groups'] = ctx.eventGroups.join(',');
  }

  // Add payload if configured
  if (options.eventPayload && ctx.params) {
    const payloadAttrs = buildDataAttributes(
      ctx.params,
      options.eventPayload,
      ctx,
      options.maxAttributeValueLength
    );
    Object.assign(attrs, prefixAttributes(payloadAttrs, 'moleculer.payload'));
  }

  return attrs;
}

/**
 * Builds response attributes for completed actions.
 */
export function buildResponseAttributes(
  result: unknown,
  config: boolean | string[] | ((data: unknown, ctx: MoleculerContext) => Record<string, unknown>),
  ctx: MoleculerContext,
  maxLength: number
): Attributes {
  if (!result) return {};

  const attrs = buildDataAttributes(result, config, ctx, maxLength);
  return prefixAttributes(attrs, 'moleculer.response');
}

/**
 * Generic data attribute builder based on configuration.
 */
function buildDataAttributes(
  data: unknown,
  config: boolean | string[] | ((data: unknown, ctx: MoleculerContext) => Record<string, unknown>),
  ctx: MoleculerContext,
  maxLength: number
): Record<string, unknown> {
  if (!data) {
    return {};
  }

  // Custom function
  if (typeof config === 'function') {
    try {
      return config(data, ctx);
    } catch {
      return {};
    }
  }

  // Include all
  if (config === true) {
    if (typeof data === 'object' && !Array.isArray(data)) {
      return flattenObject(data as Record<string, unknown>, maxLength);
    }
    const sanitized = sanitizeAttributeValue(data, maxLength);
    return sanitized !== undefined ? { value: sanitized } : {};
  }

  // Pick specific keys
  if (Array.isArray(config)) {
    if (typeof data === 'object' && !Array.isArray(data)) {
      return pickKeys(data as Record<string, unknown>, config, maxLength);
    }
    return {};
  }

  return {};
}

/**
 * Prefixes all keys in an object with a namespace.
 */
function prefixAttributes(
  attrs: Record<string, unknown>,
  prefix: string
): Attributes {
  const result: Attributes = {};

  for (const [key, value] of Object.entries(attrs)) {
    if (value !== undefined && value !== null) {
      const sanitized = sanitizeAttributeValue(value);
      if (sanitized !== undefined) {
        result[`${prefix}.${key}`] = sanitized;
      }
    }
  }

  return result;
}
