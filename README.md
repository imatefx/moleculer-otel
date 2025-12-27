# moleculer-otel

OpenTelemetry integration for [Moleculer](https://moleculer.services/) microservices framework.

This package provides automatic distributed tracing and metrics for Moleculer 0.14+ using OpenTelemetry, replacing the built-in tracing with OTEL-native middleware for better span connectivity across services and external libraries.

## Features

- **Tracing**: Automatic tracing for actions and events
- **Context Propagation**: W3C TraceContext across service boundaries
- **Metrics**: Action duration, call count, error count, event emissions
- **Baggage**: Propagate custom data across service boundaries
- **Stream Support**: Automatic tracing of streaming actions
- **Retry Tracking**: Capture retry attempts as span attributes
- **Cache Tracking**: Record cache hits/misses
- **Circuit Breaker**: Detect and record circuit breaker states
- **Timeout Tracking**: Capture timeout configurations and errors
- **Trace-Log Correlation**: Inject trace IDs into your logs
- **Per-Service Tracing**: Separate services in Jaeger when running multiple services per process
- **Auto-Instrumentation**: Support for HTTP, database, and other instrumentations
- **Sampling**: Configurable sampling strategies (always, ratio, parent-based)
- **Full TypeScript Support**
- **Compatible with any OTLP backend**: Jaeger, Grafana Tempo, Honeycomb, SigNoz, etc.

## Installation

```bash
npm install moleculer-otel @opentelemetry/api @opentelemetry/sdk-node
```

## Quick Start

### Option 1: Using the built-in SDK initializer (Recommended)

```typescript
import { initOTel, createOTelMiddleware } from 'moleculer-otel';
import { ServiceBroker } from 'moleculer';

// Initialize OpenTelemetry (call this FIRST, before importing other modules)
initOTel({
  serviceName: 'my-service',
  endpoint: 'http://localhost:4318/v1/traces',
});

const broker = new ServiceBroker({
  middlewares: [
    createOTelMiddleware({
      traceActions: true,
      traceEvents: true,
    }),
  ],
});
```

### Option 2: Manual SDK setup

```typescript
// otel-setup.ts (import this FIRST)
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

const sdk = new NodeSDK({
  serviceName: 'my-service',
  traceExporter: new OTLPTraceExporter({
    url: 'http://localhost:4318/v1/traces',
  }),
});
sdk.start();
```

```typescript
// main.ts
import './otel-setup';
import { ServiceBroker } from 'moleculer';
import { createOTelMiddleware } from 'moleculer-otel';

const broker = new ServiceBroker({
  middlewares: [createOTelMiddleware()],
});
```

### Using with Moleculer Runner

```javascript
// moleculer.config.js
const { initOTel, createOTelMiddleware } = require('moleculer-otel');

// Initialize OTEL before exporting config
initOTel({
  serviceName: process.env.SERVICE_NAME || 'moleculer-app',
  endpoint: process.env.OTEL_ENDPOINT || 'http://localhost:4318/v1/traces',
});

module.exports = {
  middlewares: [
    createOTelMiddleware({
      traceActions: true,
      traceEvents: true,
      excludeActions: ['$node.*'],
    }),
  ],
};
```

## SDK Initialization Options

```typescript
initOTel({
  // Service identification
  serviceName: 'my-service',           // Default: process.env.SERVICE_NAME
  serviceVersion: '1.0.0',             // Default: process.env.SERVICE_VERSION
  environment: 'production',           // Default: process.env.NODE_ENV

  // Exporter
  endpoint: 'http://jaeger:4318/v1/traces',  // OTLP HTTP endpoint

  // Span Processing
  batchProcessor: true,                // Use BatchSpanProcessor (default in production)
  batchOptions: {
    maxQueueSize: 2048,
    maxExportBatchSize: 512,
    scheduledDelayMillis: 5000,
    exportTimeoutMillis: 30000,
  },

  // Sampling
  sampling: {
    strategy: 'ratio',                 // 'always_on' | 'always_off' | 'ratio' | 'parent_based'
    ratio: 0.1,                        // Sample 10% of traces
  },

  // Auto-instrumentation (optional)
  instrumentations: [
    new HttpInstrumentation(),
    new MongoDBInstrumentation(),
  ],

  // Logging
  logging: true,                       // Log OTEL initialization info
});
```

## Middleware Configuration Options

```typescript
createOTelMiddleware({
  // Basic tracing
  traceActions: true,                  // Trace action calls (default: true)
  traceEvents: true,                   // Trace events (default: true)

  // Attribute inclusion
  actionParams: ['id', 'userId'],      // Include specific params in spans
  actionMeta: true,                    // Include all meta (or string[] for specific keys)
  actionResponse: ['count', 'total'],  // Include response fields
  eventPayload: true,                  // Include event payload

  // Exclusions (glob patterns)
  excludeActions: ['$node.*', 'internal.*'],
  excludeEvents: ['metrics.*'],

  // Per-service visibility in Jaeger
  perServiceTracing: true,             // Set service.name per Moleculer service

  // Metrics collection
  metrics: {
    enabled: true,
    prefix: 'myapp',                   // Metric name prefix
  },

  // Context propagation
  metaKey: '$otel',                    // Meta key for trace context

  // Limits
  maxAttributeValueLength: 1024,       // Truncate long values

  // Error handling
  errorFilter: (error, ctx) => {
    return error.name !== 'ValidationError';  // Skip validation errors
  },

  // Custom hooks
  onSpanStart: (span, ctx, type) => {
    span.setAttribute('tenant.id', ctx.meta.tenantId);
  },
  onSpanEnd: (span, ctx, result, type) => {
    if (result?.count) {
      span.setAttribute('result.count', result.count);
    }
  },
});
```

## Per-Service Visibility in Jaeger

When running multiple Moleculer services in a single process, they share the same OpenTelemetry resource. To distinguish services in Jaeger:

```typescript
createOTelMiddleware({
  perServiceTracing: true,  // Adds service.name span attribute per Moleculer service
});
```

This adds two attributes to every span:
- `moleculer.service` - Always added (filter with `moleculer.service=users`)
- `service.name` - Added when `perServiceTracing: true`

Filter in Jaeger using Tags: `moleculer.service=users`

## Metrics

Enable OpenTelemetry metrics collection:

```typescript
createOTelMiddleware({
  metrics: {
    enabled: true,
    prefix: 'myapp',  // Optional prefix
  },
});
```

Recorded metrics:
- `{prefix}.action.duration` - Histogram of action durations (ms)
- `{prefix}.action.calls` - Counter of action calls
- `{prefix}.action.errors` - Counter of failed actions
- `{prefix}.event.emits` - Counter of event emissions

## Trace-Log Correlation

Inject trace context into your logs for correlation:

```typescript
import { getTraceLogContext, createLogBindings } from 'moleculer-otel';

// Get current trace context
const traceCtx = getTraceLogContext();
// { traceId: '...', spanId: '...', traceFlags: 1 }

// Create log bindings for your logger
const bindings = createLogBindings();
// { trace_id: '...', span_id: '...', trace_sampled: true }

// Example with Pino
const logger = pino().child(createLogBindings());
logger.info('Processing request');
// Output: {"trace_id":"abc123","span_id":"def456","msg":"Processing request"}
```

## Baggage Propagation

Propagate custom data across service boundaries:

```typescript
import { withBaggage, getBaggageValue, getAllBaggage } from 'moleculer-otel';
import { context } from '@opentelemetry/api';

// Set baggage
const ctx = withBaggage({ 'tenant.id': 'abc123', 'user.role': 'admin' });

// Run code with baggage context
context.with(ctx, async () => {
  // In another service, retrieve baggage
  const tenantId = getBaggageValue('tenant.id');  // 'abc123'
  const allBaggage = getAllBaggage();  // { 'tenant.id': 'abc123', 'user.role': 'admin' }
});
```

## Span Attributes

### Automatic Attributes

The middleware automatically captures:

| Attribute | Description |
|-----------|-------------|
| `moleculer.service` | Moleculer service name |
| `moleculer.action` | Full action name |
| `moleculer.nodeID` | Node identifier |
| `moleculer.requestID` | Request ID |
| `moleculer.caller` | Calling action |
| `moleculer.level` | Call nesting level |
| `moleculer.retry.attempt` | Retry attempt number (if retrying) |
| `moleculer.retry.isRetry` | Whether this is a retry |
| `moleculer.cache.hit` | Cache hit/miss |
| `moleculer.cache.key` | Cache key used |
| `moleculer.timeout` | Configured timeout |
| `moleculer.streaming` | Whether request/response is a stream |

### Error Attributes

Errors are automatically categorized:

| Attribute | Description |
|-----------|-------------|
| `error.type` | Error class name |
| `error.message` | Error message |
| `moleculer.error.code` | Moleculer error code |
| `moleculer.error.retryable` | Whether error is retryable |
| `moleculer.error.timeout` | Whether it was a timeout error |
| `moleculer.error.circuit_breaker` | Whether circuit breaker triggered |
| `moleculer.error.validation` | Whether it was a validation error |

## Span Types

| Moleculer Operation | Span Kind | Span Name |
|---------------------|-----------|-----------|
| `ctx.call('svc.action')` | CLIENT | `call svc.action` |
| Action handler (local) | SERVER | `svc.action` |
| Action handler (remote) | CLIENT | `remote:svc.action` |
| `ctx.emit('event')` | PRODUCER | `emit:event` |
| `ctx.broadcast('event')` | PRODUCER | `broadcast:event` |
| Event handler | CONSUMER | `handle:event` |

## Advanced Usage

### Manual Span Creation

```typescript
import { getTracer } from 'moleculer-otel';

const tracer = getTracer();

async function myOperation() {
  const span = tracer.startSpan('my-custom-operation');
  try {
    span.setAttribute('custom.attr', 'value');
    // Do work
  } catch (error) {
    span.recordException(error);
    throw error;
  } finally {
    span.end();
  }
}
```

### Auto-Instrumentation

Add automatic instrumentation for HTTP, databases, etc:

```typescript
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { MongoDBInstrumentation } from '@opentelemetry/instrumentation-mongodb';
import { RedisInstrumentation } from '@opentelemetry/instrumentation-redis-4';

initOTel({
  serviceName: 'my-service',
  instrumentations: [
    new HttpInstrumentation(),
    new MongoDBInstrumentation(),
    new RedisInstrumentation(),
  ],
});
```

### Sampling Strategies

```typescript
// Sample all traces (default)
initOTel({ sampling: { strategy: 'always_on' } });

// Sample no traces (testing)
initOTel({ sampling: { strategy: 'always_off' } });

// Probabilistic sampling (10%)
initOTel({ sampling: { strategy: 'ratio', ratio: 0.1 } });

// Parent-based sampling (inherit from parent, use ratio for root spans)
initOTel({ sampling: { strategy: 'parent_based', ratio: 0.1 } });
```

## Running the Example

```bash
# Start Jaeger
docker run -d -p 16686:16686 -p 4318:4318 jaegertracing/all-in-one:latest

# Run the example
cd examples/basic-setup
npm install
npx ts-node index.ts

# View traces at http://localhost:16686
```

## API Reference

### Exports

```typescript
// Main middleware
export { createOTelMiddleware } from 'moleculer-otel';

// SDK initialization
export { initOTel, getOTelSDK, shutdownOTel } from 'moleculer-otel';

// Tracer access
export { getTracer } from 'moleculer-otel';

// Context propagation
export {
  injectContext,
  extractContext,
  hasTraceContext,
} from 'moleculer-otel';

// Baggage
export {
  getBaggage,
  getBaggageValue,
  withBaggage,
  getAllBaggage,
} from 'moleculer-otel';

// Trace-log correlation
export {
  getTraceLogContext,
  createLogBindings,
  wrapLogFunction,
  createTracingLoggerMiddleware,
} from 'moleculer-otel';

// Metrics
export { getMetrics, resetMetrics, MoleculerMetrics } from 'moleculer-otel';

// Utilities
export { shouldExclude } from 'moleculer-otel';
export {
  sanitizeAttributeValue,
  truncateValue,
  flattenObject,
  pickKeys,
} from 'moleculer-otel';
```

## License

MIT
