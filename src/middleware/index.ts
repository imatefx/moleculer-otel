import type { MoleculerMiddleware, ServiceBroker } from '../types';
import type { ResolvedOptions } from '../config/options';
import { createActionMiddleware } from './action-middleware';
import { createEventMiddleware } from './event-middleware';

/**
 * Creates the OpenTelemetry middleware for Moleculer.
 */
export function createMiddleware(options: ResolvedOptions): MoleculerMiddleware {
  const actionHandlers = createActionMiddleware(options);
  const eventHandlers = createEventMiddleware(options);

  return {
    name: 'OpenTelemetryMiddleware',

    /**
     * Called when broker is created.
     */
    created(_broker: ServiceBroker) {
      // Initialization if needed
    },

    // Action tracing hooks (only if enabled)
    ...(options.traceActions
      ? {
          localAction: actionHandlers.localAction,
          remoteAction: actionHandlers.remoteAction,
          call: actionHandlers.call,
        }
      : {}),

    // Event tracing hooks (only if enabled)
    ...(options.traceEvents
      ? {
          emit: eventHandlers.emit,
          broadcast: eventHandlers.broadcast,
          localEvent: eventHandlers.localEvent,
        }
      : {}),
  };
}

export { createActionMiddleware } from './action-middleware';
export { createEventMiddleware } from './event-middleware';
