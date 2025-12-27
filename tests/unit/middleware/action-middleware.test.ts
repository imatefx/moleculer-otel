import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { SpanKind, SpanStatusCode } from '@opentelemetry/api';
import {
  setupTestTracing,
  getExportedSpans,
  clearSpans,
  teardownTestTracing,
  findSpanByName,
  findSpansByAttribute,
  areSameTrace,
} from '../../helpers/test-setup';
import { createTestBroker, createTestService } from '../../helpers/mock-broker';
import type { ServiceBroker } from 'moleculer';

describe('Action Middleware', () => {
  let broker: ServiceBroker;

  beforeAll(() => {
    setupTestTracing();
  });

  afterAll(async () => {
    await broker?.stop();
    teardownTestTracing();
  });

  beforeEach(() => {
    clearSpans();
  });

  describe('localAction tracing', () => {
    beforeAll(async () => {
      broker = createTestBroker({ traceActions: true });
      createTestService(broker);
      await broker.start();
    });

    it('should create a span for local action execution', async () => {
      await broker.call('test.hello');

      const spans = getExportedSpans();
      expect(spans.length).toBeGreaterThan(0);

      const actionSpan = findSpanByName('test.hello');
      expect(actionSpan).toBeDefined();
      expect(actionSpan?.kind).toBe(SpanKind.SERVER);
      expect(actionSpan?.status.code).toBe(SpanStatusCode.OK);
    });

    it('should include RPC semantic convention attributes', async () => {
      await broker.call('test.hello');

      const span = findSpanByName('test.hello');
      expect(span?.attributes['rpc.system']).toBe('moleculer');
      expect(span?.attributes['rpc.service']).toBe('test');
      expect(span?.attributes['rpc.method']).toBe('test.hello');
    });

    it('should include moleculer-specific attributes', async () => {
      await broker.call('test.hello');

      const span = findSpanByName('test.hello');
      expect(span?.attributes['moleculer.action']).toBe('test.hello');
      expect(span?.attributes['moleculer.nodeID']).toBeDefined();
      expect(span?.attributes['moleculer.requestID']).toBeDefined();
    });

    it('should record errors properly', async () => {
      try {
        await broker.call('test.error');
      } catch {
        // Expected
      }

      const span = findSpanByName('test.error');
      expect(span).toBeDefined();
      expect(span?.status.code).toBe(SpanStatusCode.ERROR);
      expect(span?.status.message).toBe('Test error');
      expect(span?.events.length).toBeGreaterThan(0);
      expect(span?.events[0].name).toBe('exception');
    });
  });

  describe('nested action calls', () => {
    beforeAll(async () => {
      broker = createTestBroker({ traceActions: true });
      createTestService(broker);
      await broker.start();
    });

    it('should propagate context to nested calls', async () => {
      await broker.call('test.nested');

      const spans = getExportedSpans();
      const outerSpan = spans.find((s) => s.name.includes('test.nested'));
      const innerSpan = spans.find((s) => s.name.includes('test.hello'));

      expect(outerSpan).toBeDefined();
      expect(innerSpan).toBeDefined();

      // Should share the same trace ID
      if (outerSpan && innerSpan) {
        expect(areSameTrace(outerSpan, innerSpan)).toBe(true);
      }
    });

    it('should create parent-child relationship', async () => {
      await broker.call('test.nested');

      const spans = getExportedSpans();
      const nestedSpan = findSpanByName('test.nested');
      const helloSpan = findSpanByName('test.hello');

      expect(nestedSpan).toBeDefined();
      expect(helloSpan).toBeDefined();

      // The hello span should have a parent
      expect(helloSpan?.parentSpanId).toBeDefined();
    });
  });

  describe('action params tracing', () => {
    it('should include specific params when configured', async () => {
      broker = createTestBroker({
        traceActions: true,
        actionParams: ['name'],
      });
      createTestService(broker);
      await broker.start();

      await broker.call('test.hello', { name: 'John', secret: 'password' });

      const span = findSpanByName('test.hello');
      expect(span?.attributes['moleculer.params.name']).toBe('John');
      expect(span?.attributes['moleculer.params.secret']).toBeUndefined();

      await broker.stop();
    });

    it('should include all params when set to true', async () => {
      broker = createTestBroker({
        traceActions: true,
        actionParams: true,
      });
      createTestService(broker);
      await broker.start();

      await broker.call('test.echo', { foo: 'bar', num: 123 });

      const span = findSpanByName('test.echo');
      expect(span?.attributes['moleculer.params.foo']).toBe('bar');
      expect(span?.attributes['moleculer.params.num']).toBe(123);

      await broker.stop();
    });
  });

  describe('action exclusions', () => {
    it('should exclude actions matching patterns', async () => {
      broker = createTestBroker({
        traceActions: true,
        excludeActions: ['test.hello'],
      });
      createTestService(broker);
      await broker.start();

      await broker.call('test.hello');

      const span = findSpanByName('test.hello');
      expect(span).toBeUndefined();

      await broker.stop();
    });

    it('should support glob patterns', async () => {
      broker = createTestBroker({
        traceActions: true,
        excludeActions: ['test.*'],
      });
      createTestService(broker);
      await broker.start();

      await broker.call('test.hello');
      await broker.call('test.echo', { data: 'test' });

      const spans = getExportedSpans();
      const testSpans = spans.filter((s) => s.name.startsWith('test.'));
      expect(testSpans.length).toBe(0);

      await broker.stop();
    });
  });

  describe('custom hooks', () => {
    it('should call onSpanStart hook', async () => {
      let hookCalled = false;

      broker = createTestBroker({
        traceActions: true,
        onSpanStart: (span, ctx, type) => {
          hookCalled = true;
          span.setAttribute('custom.hook', 'start');
          expect(type).toBe('action');
        },
      });
      createTestService(broker);
      await broker.start();

      await broker.call('test.hello');

      expect(hookCalled).toBe(true);
      const span = findSpanByName('test.hello');
      expect(span?.attributes['custom.hook']).toBe('start');

      await broker.stop();
    });

    it('should call onSpanEnd hook', async () => {
      let hookCalled = false;

      broker = createTestBroker({
        traceActions: true,
        onSpanEnd: (span, ctx, result, type) => {
          hookCalled = true;
          span.setAttribute('custom.result', String(result));
        },
      });
      createTestService(broker);
      await broker.start();

      await broker.call('test.hello', { name: 'Test' });

      expect(hookCalled).toBe(true);
      const span = findSpanByName('test.hello');
      expect(span?.attributes['custom.result']).toBe('Hello Test!');

      await broker.stop();
    });
  });
});
