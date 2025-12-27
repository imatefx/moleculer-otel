# moleculer-otel

OpenTelemetry integration for [Moleculer](https://moleculer.services/) microservices framework.

This package provides automatic distributed tracing for Moleculer 0.14+ using OpenTelemetry, replacing the built-in tracing with OTEL-native middleware for better span connectivity across services and external libraries.

## Features

- Automatic tracing for actions and events
- Context propagation across service boundaries (W3C TraceContext)
- Configurable span attributes (params, meta, response)
- Glob pattern exclusions for internal actions
- Custom hooks for span customization
- Full TypeScript support
- Compatible with any OTLP-compatible backend (Jaeger, Grafana Tempo, SigNoz, etc.)

## Installation

```bash
npm install moleculer-otel @opentelemetry/api @opentelemetry/sdk-node @opentelemetry/exporter-trace-otlp-proto
```

## Quick Start

### 1. Set up OpenTelemetry SDK

Create `otel-setup.ts` (must be imported **before** Moleculer):

```typescript
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';

const sdk = new NodeSDK({
  serviceName: 'my-service',
  traceExporter: new OTLPTraceExporter({
    url: 'http://localhost:4318/v1/traces',
  }),
});

sdk.start();
```

### 2. Configure Moleculer with the middleware

```typescript
// IMPORTANT: Import OTEL setup first!
import './otel-setup';

import { ServiceBroker } from 'moleculer';
import { createOTelMiddleware } from 'moleculer-otel';

const broker = new ServiceBroker({
  // Disable built-in tracing
  tracing: false,

  middlewares: [
    createOTelMiddleware({
      traceActions: true,
      traceEvents: true,
      actionParams: ['id', 'userId'],
      excludeActions: ['$node.*'],
    }),
  ],
});
```

### 3. Start a tracing backend

```bash
# Start Jaeger with OTLP support
docker run -d -p 16686:16686 -p 4318:4318 jaegertracing/all-in-one:latest

# View traces at http://localhost:16686
```

## Configuration Options

```typescript
interface MoleculerOTelOptions {
  // Enable action tracing (default: true)
  traceActions?: boolean;

  // Enable event tracing (default: true)
  traceEvents?: boolean;

  // Include action params in spans
  // - true: all params
  // - string[]: specific keys
  // - function: custom extractor
  actionParams?: boolean | string[] | ((params, ctx) => Record<string, unknown>);

  // Include meta in spans (same options as actionParams)
  actionMeta?: boolean | string[] | ((meta, ctx) => Record<string, unknown>);

  // Include response in spans
  actionResponse?: boolean | string[] | ((response, ctx) => Record<string, unknown>);

  // Include event payload in spans
  eventPayload?: boolean | string[] | ((payload, ctx) => Record<string, unknown>);

  // Exclude actions matching glob patterns
  excludeActions?: string[];  // e.g., ['$node.*', 'internal.*']

  // Exclude events matching glob patterns
  excludeEvents?: string[];

  // Meta key for context propagation (default: '$otel')
  metaKey?: string;

  // Max attribute value length before truncation (default: 1024)
  maxAttributeValueLength?: number;

  // Custom error filter
  errorFilter?: (error: Error, ctx) => boolean;

  // Custom hook when span starts
  onSpanStart?: (span, ctx, type) => void;

  // Custom hook when span ends
  onSpanEnd?: (span, ctx, result, type) => void;
}
```

## Span Types

| Moleculer Operation | Span Kind | Span Name |
|---------------------|-----------|-----------|
| `ctx.call('svc.action')` | CLIENT | `call svc.action` |
| Action handler (local) | SERVER | `svc.action` |
| Action handler (remote) | CLIENT | `remote:svc.action` |
| `ctx.emit('event')` | PRODUCER | `emit:event` |
| `ctx.broadcast('event')` | PRODUCER | `broadcast:event` |
| Event handler | CONSUMER | `handle:event` |

## Semantic Conventions

The middleware follows OpenTelemetry semantic conventions:

### RPC Spans (Actions)
- `rpc.system`: "moleculer"
- `rpc.service`: Service name
- `rpc.method`: Full action name

### Messaging Spans (Events)
- `messaging.system`: "moleculer"
- `messaging.operation`: "emit" | "broadcast" | "receive"
- `messaging.destination.name`: Event name

### Moleculer-specific Attributes
- `moleculer.action`: Action name
- `moleculer.event`: Event name
- `moleculer.nodeID`: Node identifier
- `moleculer.requestID`: Request ID
- `moleculer.caller`: Caller action
- `moleculer.level`: Call level

## Advanced Usage

### Manual Span Creation

```typescript
import { getTracer } from 'moleculer-otel';

const tracer = getTracer();

async function myOperation() {
  const span = tracer.startSpan('my-custom-operation');
  try {
    // Do work
    span.setAttribute('custom.attr', 'value');
  } finally {
    span.end();
  }
}
```

### Custom Attribute Extraction

```typescript
createOTelMiddleware({
  actionParams: (params, ctx) => {
    // Only include safe params
    const { password, token, ...safe } = params;
    return safe;
  },

  onSpanStart: (span, ctx, type) => {
    // Add custom attributes
    span.setAttribute('tenant.id', ctx.meta.tenantId);
  },

  onSpanEnd: (span, ctx, result, type) => {
    if (result && typeof result === 'object') {
      span.setAttribute('result.count', result.count);
    }
  },
});
```

### Error Filtering

```typescript
createOTelMiddleware({
  errorFilter: (error, ctx) => {
    // Don't record validation errors as span errors
    return error.name !== 'ValidationError';
  },
});
```

## Running the Example

```bash
# Start Jaeger
cd examples/basic-setup
docker-compose up -d

# Run the example
npm install
npx ts-node examples/basic-setup/index.ts

# View traces at http://localhost:16686
```

## License

MIT
