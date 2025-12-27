/**
 * OpenTelemetry SDK Setup using moleculer-otel
 *
 * IMPORTANT: This file must be imported BEFORE any other modules
 * to ensure proper instrumentation of all libraries.
 *
 * Environment variables:
 *   OTEL_EXPORTER_PROTOCOL: 'http' or 'grpc' (default: 'http')
 *   OTEL_EXPORTER_OTLP_ENDPOINT: Custom endpoint URL
 *   SERVICE_NAME: Service name for traces (default: 'moleculer-example')
 *   NODE_ENV: Environment (production uses BatchSpanProcessor)
 */

import { initOTel } from '../../src';

// Determine protocol and endpoint
const protocol = (process.env.OTEL_EXPORTER_PROTOCOL || 'http').toLowerCase();
const defaultEndpoints = {
  http: 'https://jaeger-http-col.linemeup.in/v1/traces',
  grpc: 'https://jaeger-grpc-col.linemeup.in',
};
const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT ||
  defaultEndpoints[protocol as keyof typeof defaultEndpoints] ||
  defaultEndpoints.http;

console.log(`[OTEL] Protocol: ${protocol.toUpperCase()}`);

// Initialize OpenTelemetry with sensible defaults
// - Uses BatchSpanProcessor in production, SimpleSpanProcessor in development
// - Automatically registers shutdown handlers
export const sdk = initOTel({
  serviceName: process.env.SERVICE_NAME || 'moleculer-example',
  serviceVersion: '1.0.0',
  environment: process.env.NODE_ENV || 'development',
  endpoint,
  // Force batch processor to test it (normally auto-detects from NODE_ENV)
  // batchProcessor: true,
  // batchOptions: {
  //   maxQueueSize: 2048,
  //   maxExportBatchSize: 512,
  //   scheduledDelayMillis: 5000,
  // },
});
