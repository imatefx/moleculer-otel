import {
  context,
  propagation,
  Context as OTelContext,
  Baggage,
  BaggageEntry,
} from '@opentelemetry/api';

/**
 * Carrier type for Moleculer meta propagation.
 * Maps to traceparent and tracestate headers (W3C Trace Context).
 * Also includes baggage header for W3C Baggage propagation.
 */
export interface TraceCarrier {
  traceparent?: string;
  tracestate?: string;
  baggage?: string;
}

/**
 * TextMap getter implementation for extracting context from carrier
 */
const textMapGetter = {
  get(carrier: TraceCarrier, key: string): string | undefined {
    return carrier[key as keyof TraceCarrier];
  },
  keys(carrier: TraceCarrier): string[] {
    return Object.keys(carrier);
  },
};

/**
 * TextMap setter implementation for injecting context into carrier
 */
const textMapSetter = {
  set(carrier: TraceCarrier, key: string, value: string): void {
    carrier[key as keyof TraceCarrier] = value;
  },
};

/**
 * Injects the current trace context into a carrier object.
 * The carrier is then stored in Moleculer's ctx.meta for propagation.
 *
 * @param ctx - The OpenTelemetry context to inject
 * @param carrier - The carrier object to inject into
 */
export function injectContext(ctx: OTelContext, carrier: TraceCarrier): void {
  propagation.inject(ctx, carrier, textMapSetter);
}

/**
 * Extracts trace context from a carrier object.
 * Used when receiving requests from other services.
 *
 * @param ctx - The parent OpenTelemetry context
 * @param carrier - The carrier object containing trace headers
 * @returns The extracted context with trace information
 */
export function extractContext(ctx: OTelContext, carrier: TraceCarrier): OTelContext {
  return propagation.extract(ctx, carrier, textMapGetter);
}

/**
 * Gets the currently active context.
 */
export function getActiveContext(): OTelContext {
  return context.active();
}

/**
 * Checks if a carrier contains valid trace context.
 */
export function hasTraceContext(carrier: TraceCarrier): boolean {
  return typeof carrier.traceparent === 'string' && carrier.traceparent.length > 0;
}

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
export function getBaggage(): Baggage | undefined {
  return propagation.getBaggage(context.active());
}

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
export function getBaggageValue(key: string): string | undefined {
  const baggage = getBaggage();
  return baggage?.getEntry(key)?.value;
}

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
export function withBaggage(
  entries: Record<string, string | BaggageEntry>,
  parentContext?: OTelContext
): OTelContext {
  const ctx = parentContext ?? context.active();
  const currentBaggage = propagation.getBaggage(ctx) ?? propagation.createBaggage();

  let newBaggage = currentBaggage;
  for (const [key, value] of Object.entries(entries)) {
    const entry: BaggageEntry = typeof value === 'string' ? { value } : value;
    newBaggage = newBaggage.setEntry(key, entry);
  }

  return propagation.setBaggage(ctx, newBaggage);
}

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
export function getAllBaggage(): Record<string, string> {
  const baggage = getBaggage();
  if (!baggage) {
    return {};
  }

  const entries: Record<string, string> = {};
  for (const [key, entry] of baggage.getAllEntries()) {
    entries[key] = entry.value;
  }
  return entries;
}
