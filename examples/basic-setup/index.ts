/**
 * Basic Moleculer + OpenTelemetry Example
 *
 * This example demonstrates how to integrate OpenTelemetry tracing
 * with Moleculer microservices.
 *
 * Run with: npx ts-node examples/basic-setup/index.ts
 *
 * Prerequisites:
 * - Start Jaeger: docker run -d -p 16686:16686 -p 4318:4318 jaegertracing/all-in-one:latest
 * - View traces at: http://localhost:16686
 */

// IMPORTANT: Import OTEL setup FIRST
import './otel-setup';

import { ServiceBroker, Context, Middleware } from 'moleculer';
import { createOTelMiddleware } from '../../src';

// Create broker with OpenTelemetry middleware
const broker = new ServiceBroker({
  nodeID: 'node-1',
  logger: {
    type: 'Console',
    options: {
      level: 'info',
    },
  },
  // Disable built-in tracing (we're using OTEL instead)
  tracing: false,
  middlewares: [
    (() => {
      const mw = createOTelMiddleware({
        traceActions: true,
        traceEvents: true,
        // Include specific params in spans
        actionParams: ['id', 'name', 'userId'],
        // Exclude internal actions
        excludeActions: ['$node.*'],
        // Add custom attributes
        onSpanStart: (span, _ctx, _type) => {
          console.log('[OTEL] Span started:', span.spanContext().spanId);
          span.setAttribute('custom.timestamp', Date.now());
        },
        onSpanEnd: (_span, _ctx, _result, _type) => {
          console.log('[OTEL] Span ended');
        },
      });
      console.log('[OTEL] Middleware created:', mw.name);
      return mw;
    })() as Middleware,
  ],
});

// User service
broker.createService({
  name: 'users',
  actions: {
    get: {
      params: {
        id: 'string',
      },
      async handler(ctx: Context<{ id: string }>) {
        // Simulate DB lookup
        await new Promise((resolve) => setTimeout(resolve, 50));

        return {
          id: ctx.params.id,
          name: 'John Doe',
          email: 'john@example.com',
        };
      },
    },
    list: {
      async handler() {
        await new Promise((resolve) => setTimeout(resolve, 30));

        return [
          { id: '1', name: 'John Doe' },
          { id: '2', name: 'Jane Smith' },
        ];
      },
    },
  },
  events: {
    'user.created': {
      async handler(ctx: Context<{ userId: string; name: string }>) {
        console.log(`User created event received: ${ctx.params.name}`);
      },
    },
  },
});

// Order service (demonstrates cross-service tracing)
broker.createService({
  name: 'orders',
  actions: {
    create: {
      params: {
        userId: 'string',
        items: 'array',
      },
      async handler(ctx: Context<{ userId: string; items: any[] }>) {
        // Call user service (creates child span)
        await ctx.call('users.get', { id: ctx.params.userId });

        // Simulate order creation
        await new Promise((resolve) => setTimeout(resolve, 100));

        const order = {
          id: `order-${Date.now()}`,
          userId: ctx.params.userId,
          items: ctx.params.items,
          status: 'created',
        };

        // Emit event (creates producer span)
        await ctx.emit('order.created', {
          orderId: order.id,
          userId: ctx.params.userId,
        });

        return order;
      },
    },
  },
  events: {
    'order.created': {
      async handler(ctx: Context<{ orderId: string; userId: string }>) {
        console.log(`Order created: ${ctx.params.orderId}`);

        // Notify user (demonstrates nested event -> action call)
        await ctx.call('users.get', { id: ctx.params.userId });
      },
    },
  },
});

// Start broker and run demo
async function main() {
  await broker.start();

  console.log('\n--- Running demo requests ---\n');

  // Simple action call
  console.log('1. Getting user...');
  const user = await broker.call('users.get', { id: '123' }) as { id: string; name: string; email: string };
  console.log('User:', user.name);

  // Cross-service call with event emission
  console.log('\n2. Creating order...');
  const order = await broker.call('orders.create', {
    userId: '123',
    items: [{ product: 'Widget', qty: 2 }],
  });
  console.log('Order:', order);


  // Wait for events to process
  await new Promise((resolve) => setTimeout(resolve, 500));

  console.log('\n--- Demo complete ---');
  console.log('Flushing traces...');

  // Wait longer for traces to be exported
  await new Promise((resolve) => setTimeout(resolve, 3000));

  console.log('View traces at: http://localhost:16686');

  // Graceful shutdown
  await broker.stop();
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
