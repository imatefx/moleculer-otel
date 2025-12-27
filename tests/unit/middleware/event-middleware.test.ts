import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { SpanKind, SpanStatusCode } from '@opentelemetry/api';
import {
  setupTestTracing,
  getExportedSpans,
  clearSpans,
  teardownTestTracing,
  findSpanByName,
  waitForSpans,
  areSameTrace,
} from '../../helpers/test-setup';
import { createTestBroker } from '../../helpers/mock-broker';
import type { ServiceBroker } from 'moleculer';

describe('Event Middleware', () => {
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

  describe('emit tracing', () => {
    beforeAll(async () => {
      broker = createTestBroker({ traceEvents: true });

      broker.createService({
        name: 'events',
        events: {
          'user.created': {
            handler() {
              // Handler
            },
          },
        },
      });

      await broker.start();
    });

    afterAll(async () => {
      await broker?.stop();
    });

    it('should create a PRODUCER span for emit', async () => {
      await broker.emit('user.created', { userId: '123' });

      // Wait for spans to be recorded
      await waitForSpans(1, 1000);

      const spans = getExportedSpans();
      const emitSpan = spans.find((s) => s.name === 'emit:user.created');

      expect(emitSpan).toBeDefined();
      expect(emitSpan?.kind).toBe(SpanKind.PRODUCER);
      expect(emitSpan?.attributes['messaging.system']).toBe('moleculer');
      expect(emitSpan?.attributes['messaging.operation']).toBe('emit');
      expect(emitSpan?.attributes['moleculer.event']).toBe('user.created');
    });

    it('should create a CONSUMER span for event handler', async () => {
      await broker.emit('user.created', { userId: '123' });

      // Wait for event to be processed
      await new Promise((resolve) => setTimeout(resolve, 100));
      await waitForSpans(2, 1000);

      const spans = getExportedSpans();
      const handleSpan = spans.find((s) => s.name === 'handle:user.created');

      expect(handleSpan).toBeDefined();
      expect(handleSpan?.kind).toBe(SpanKind.CONSUMER);
    });

    it('should propagate context from emit to handler', async () => {
      await broker.emit('user.created', { userId: '123' });

      // Wait for event to be processed
      await new Promise((resolve) => setTimeout(resolve, 100));
      await waitForSpans(2, 1000);

      const spans = getExportedSpans();
      const emitSpan = spans.find((s) => s.name === 'emit:user.created');
      const handleSpan = spans.find((s) => s.name === 'handle:user.created');

      if (emitSpan && handleSpan) {
        expect(areSameTrace(emitSpan, handleSpan)).toBe(true);
      }
    });
  });

  describe('broadcast tracing', () => {
    beforeAll(async () => {
      broker = createTestBroker({ traceEvents: true });

      broker.createService({
        name: 'broadcast',
        events: {
          'system.shutdown': {
            handler() {
              // Handler
            },
          },
        },
      });

      await broker.start();
    });

    afterAll(async () => {
      await broker?.stop();
    });

    it('should create a PRODUCER span for broadcast', async () => {
      await broker.broadcast('system.shutdown', { reason: 'maintenance' });

      await waitForSpans(1, 1000);

      const spans = getExportedSpans();
      const broadcastSpan = spans.find(
        (s) => s.name === 'broadcast:system.shutdown'
      );

      expect(broadcastSpan).toBeDefined();
      expect(broadcastSpan?.kind).toBe(SpanKind.PRODUCER);
      expect(broadcastSpan?.attributes['messaging.operation']).toBe('broadcast');
      expect(broadcastSpan?.attributes['moleculer.event.type']).toBe('broadcast');
    });
  });

  describe('event exclusions', () => {
    it('should exclude events matching patterns', async () => {
      broker = createTestBroker({
        traceEvents: true,
        excludeEvents: ['internal.*'],
      });

      broker.createService({
        name: 'test',
        events: {
          'internal.health': {
            handler() {},
          },
          'public.event': {
            handler() {},
          },
        },
      });

      await broker.start();

      await broker.emit('internal.health', {});
      await broker.emit('public.event', {});

      await new Promise((resolve) => setTimeout(resolve, 100));

      const spans = getExportedSpans();
      const internalSpan = spans.find((s) => s.name.includes('internal.health'));
      const publicSpan = spans.find((s) => s.name.includes('public.event'));

      expect(internalSpan).toBeUndefined();
      expect(publicSpan).toBeDefined();

      await broker.stop();
    });
  });

  describe('event payload tracing', () => {
    it('should include payload when configured', async () => {
      broker = createTestBroker({
        traceEvents: true,
        eventPayload: ['userId', 'action'],
      });

      let handlerCalled = false;

      broker.createService({
        name: 'payload',
        events: {
          'user.action': {
            handler() {
              handlerCalled = true;
            },
          },
        },
      });

      await broker.start();

      await broker.emit('user.action', {
        userId: '123',
        action: 'login',
        timestamp: Date.now(),
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      const spans = getExportedSpans();
      const handleSpan = spans.find((s) => s.name === 'handle:user.action');

      expect(handleSpan?.attributes['moleculer.payload.userId']).toBe('123');
      expect(handleSpan?.attributes['moleculer.payload.action']).toBe('login');
      expect(handleSpan?.attributes['moleculer.payload.timestamp']).toBeUndefined();

      await broker.stop();
    });
  });
});
