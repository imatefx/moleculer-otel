import { context, trace } from '@opentelemetry/api';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import {
  InMemorySpanExporter,
  SimpleSpanProcessor,
  ReadableSpan,
} from '@opentelemetry/sdk-trace-base';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';

let provider: NodeTracerProvider;
let exporter: InMemorySpanExporter;
let contextManager: AsyncLocalStorageContextManager;

/**
 * Sets up OpenTelemetry for testing with in-memory span export.
 */
export function setupTestTracing() {
  exporter = new InMemorySpanExporter();
  provider = new NodeTracerProvider();
  provider.addSpanProcessor(new SimpleSpanProcessor(exporter));

  contextManager = new AsyncLocalStorageContextManager();
  contextManager.enable();
  context.setGlobalContextManager(contextManager);

  provider.register();

  return { provider, exporter };
}

/**
 * Gets all spans that have been exported.
 */
export function getExportedSpans(): ReadableSpan[] {
  return exporter.getFinishedSpans();
}

/**
 * Clears all exported spans.
 */
export function clearSpans(): void {
  exporter.reset();
}

/**
 * Tears down the test tracing infrastructure.
 */
export function teardownTestTracing(): void {
  contextManager.disable();
  provider.shutdown();
}

/**
 * Finds a span by its name.
 */
export function findSpanByName(name: string): ReadableSpan | undefined {
  return getExportedSpans().find((span) => span.name === name);
}

/**
 * Finds all spans matching a name pattern.
 */
export function findSpansByNamePattern(pattern: RegExp): ReadableSpan[] {
  return getExportedSpans().filter((span) => pattern.test(span.name));
}

/**
 * Finds spans by an attribute value.
 */
export function findSpansByAttribute(
  attrName: string,
  attrValue: unknown
): ReadableSpan[] {
  return getExportedSpans().filter(
    (span) => span.attributes[attrName] === attrValue
  );
}

/**
 * Gets the trace ID from a span.
 */
export function getTraceId(span: ReadableSpan): string {
  return span.spanContext().traceId;
}

/**
 * Gets the span ID from a span.
 */
export function getSpanId(span: ReadableSpan): string {
  return span.spanContext().spanId;
}

/**
 * Checks if two spans belong to the same trace.
 */
export function areSameTrace(span1: ReadableSpan, span2: ReadableSpan): boolean {
  return getTraceId(span1) === getTraceId(span2);
}

/**
 * Waits for spans to be exported (useful for async operations).
 */
export async function waitForSpans(
  count: number,
  timeout = 5000
): Promise<void> {
  const startTime = Date.now();

  while (getExportedSpans().length < count) {
    if (Date.now() - startTime > timeout) {
      throw new Error(
        `Timeout waiting for ${count} spans. Got ${getExportedSpans().length}`
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
