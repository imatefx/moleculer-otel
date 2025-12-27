import type { MoleculerOTelOptions, ResolvedOptions } from './options';

/**
 * Default configuration values
 */
export const DEFAULT_OPTIONS: ResolvedOptions = {
  traceActions: true,
  traceEvents: true,
  actionParams: false,
  actionMeta: false,
  actionResponse: false,
  eventPayload: false,
  metaKey: '$otel',
  excludeActions: [],
  excludeEvents: [],
  maxAttributeValueLength: 1024,
  perServiceTracing: false,
};

/**
 * Merges user options with defaults
 */
export function resolveOptions(options: MoleculerOTelOptions = {}): ResolvedOptions {
  return {
    ...DEFAULT_OPTIONS,
    ...options,
    excludeActions: options.excludeActions ?? DEFAULT_OPTIONS.excludeActions,
    excludeEvents: options.excludeEvents ?? DEFAULT_OPTIONS.excludeEvents,
  };
}
