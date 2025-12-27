import { ServiceBroker } from 'moleculer';
import { createOTelMiddleware } from '../../src';
import type { MoleculerOTelOptions } from '../../src';

/**
 * Creates a test broker with OpenTelemetry middleware.
 */
export function createTestBroker(
  options: MoleculerOTelOptions = {},
  brokerOptions: Partial<{
    nodeID: string;
    transporter: string;
  }> = {}
): ServiceBroker {
  return new ServiceBroker({
    nodeID: brokerOptions.nodeID || 'test-node',
    logger: false,
    tracing: false, // Disable built-in tracing
    transporter: brokerOptions.transporter,
    middlewares: [createOTelMiddleware(options)],
  });
}

/**
 * Creates a simple test service.
 */
export function createTestService(broker: ServiceBroker) {
  return broker.createService({
    name: 'test',
    actions: {
      hello: {
        params: {
          name: { type: 'string', optional: true },
        },
        handler(ctx) {
          return `Hello ${ctx.params.name || 'World'}!`;
        },
      },
      echo: {
        handler(ctx) {
          return ctx.params;
        },
      },
      error: {
        handler() {
          throw new Error('Test error');
        },
      },
      nested: {
        async handler(ctx) {
          const result = await ctx.call('test.hello', { name: 'Nested' });
          return { nested: result };
        },
      },
      delay: {
        params: {
          ms: 'number',
        },
        async handler(ctx) {
          await new Promise((resolve) => setTimeout(resolve, ctx.params.ms));
          return 'done';
        },
      },
    },
    events: {
      'test.event': {
        handler(ctx) {
          // Event handler
        },
      },
    },
  });
}
