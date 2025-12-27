import type { Span } from '@opentelemetry/api';

/**
 * Moleculer Context type (simplified for middleware use)
 */
export interface MoleculerContext {
  id: string;
  requestID: string;
  nodeID: string;
  caller: string | null;
  level: number;
  params: unknown;
  meta: Record<string, unknown>;
  service?: {
    name: string;
    version?: string;
  };
  action?: {
    name: string;
  };
  eventName?: string;
  eventType?: string;
  eventGroups?: string[];
  options?: {
    timeout?: number;
    retries?: number;
    [key: string]: unknown;
  };
  // Internal properties for retry tracking
  _retryAttempts?: number;
  cachedResult?: boolean;
  call: (actionName: string, params?: unknown, opts?: CallOptions) => Promise<unknown>;
  emit: (eventName: string, payload?: unknown, opts?: EmitOptions) => Promise<void>;
  broadcast: (eventName: string, payload?: unknown, opts?: EmitOptions) => Promise<void>;
}

/**
 * Call options for action invocations
 */
export interface CallOptions {
  timeout?: number;
  retries?: number;
  meta?: Record<string, unknown>;
  nodeID?: string;
  [key: string]: unknown;
}

/**
 * Emit options for events
 */
export interface EmitOptions {
  groups?: string[];
  meta?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Action schema definition
 */
export interface ActionSchema {
  name: string;
  rawName?: string;
  handler?: (ctx: MoleculerContext) => Promise<unknown>;
  params?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Event schema definition
 */
export interface EventSchema {
  name: string;
  group?: string;
  handler?: (ctx: MoleculerContext) => Promise<void>;
  [key: string]: unknown;
}

/**
 * Service broker interface (simplified)
 */
export interface ServiceBroker {
  nodeID: string;
  Promise: PromiseConstructor;
  logger: unknown;
  call: (actionName: string, params?: unknown, opts?: CallOptions) => Promise<unknown>;
  emit: (eventName: string, payload?: unknown, opts?: EmitOptions) => Promise<void>;
  broadcast: (eventName: string, payload?: unknown, opts?: EmitOptions) => Promise<void>;
}

/**
 * Moleculer middleware interface
 */
export interface MoleculerMiddleware {
  name: string;
  created?: (broker: ServiceBroker) => void;
  started?: (broker: ServiceBroker) => Promise<void>;
  stopped?: (broker: ServiceBroker) => Promise<void>;
  localAction?: (
    next: (ctx: MoleculerContext) => Promise<unknown>,
    action: ActionSchema
  ) => (ctx: MoleculerContext) => Promise<unknown>;
  remoteAction?: (
    next: (ctx: MoleculerContext) => Promise<unknown>,
    action: ActionSchema
  ) => (ctx: MoleculerContext) => Promise<unknown>;
  call?: (
    next: (actionName: string, params: unknown, opts: CallOptions) => Promise<unknown>
  ) => (actionName: string, params: unknown, opts: CallOptions) => Promise<unknown>;
  emit?: (
    next: (eventName: string, payload: unknown, opts: EmitOptions) => Promise<void>
  ) => (eventName: string, payload: unknown, opts: EmitOptions) => Promise<void>;
  broadcast?: (
    next: (eventName: string, payload: unknown, opts: EmitOptions) => Promise<void>
  ) => (eventName: string, payload: unknown, opts: EmitOptions) => Promise<void>;
  localEvent?: (
    next: (ctx: MoleculerContext) => Promise<void>,
    event: EventSchema
  ) => (ctx: MoleculerContext) => Promise<void>;
  // Index signature for Moleculer compatibility
  [key: string]: unknown;
}

/**
 * Span type for hooks
 */
export type SpanType = 'action' | 'event';

/**
 * Callback for span start hook
 */
export type OnSpanStartCallback = (
  span: Span,
  ctx: MoleculerContext,
  type: SpanType
) => void;

/**
 * Callback for span end hook
 */
export type OnSpanEndCallback = (
  span: Span,
  ctx: MoleculerContext,
  result: unknown,
  type: SpanType
) => void;

/**
 * Error filter callback
 */
export type ErrorFilterCallback = (
  error: Error,
  ctx: MoleculerContext
) => boolean;

/**
 * Attribute extractor function type
 */
export type AttributeExtractor<T> = (
  data: T,
  ctx: MoleculerContext
) => Record<string, unknown>;
