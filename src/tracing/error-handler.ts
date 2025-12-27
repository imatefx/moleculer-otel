import { Span, SpanStatusCode } from '@opentelemetry/api';
import type { MoleculerContext } from '../types';
import type { ResolvedOptions } from '../config/options';

/**
 * Records an error on a span following OTEL semantic conventions.
 */
export function recordError(
  span: Span,
  error: Error,
  ctx: MoleculerContext | null,
  options: ResolvedOptions
): void {
  // Check if error should be filtered out
  if (options.errorFilter && ctx) {
    try {
      if (!options.errorFilter(error, ctx)) {
        return;
      }
    } catch {
      // If filter throws, record the error anyway
    }
  }

  // Record exception event
  span.recordException(error);

  // Set error status
  span.setStatus({
    code: SpanStatusCode.ERROR,
    message: error.message,
  });

  // Add error attributes following OTEL semantic conventions
  span.setAttributes({
    'error.type': error.constructor.name,
    'error.message': error.message,
  });

  // Add Moleculer-specific error attributes if available
  const moleculerError = error as MoleculerError;

  if (moleculerError.code) {
    span.setAttribute('moleculer.error.code', moleculerError.code);
  }

  if (moleculerError.type) {
    span.setAttribute('moleculer.error.type', moleculerError.type);
  }

  if (moleculerError.data) {
    try {
      span.setAttribute(
        'moleculer.error.data',
        JSON.stringify(moleculerError.data).slice(0, 1024)
      );
    } catch {
      // Ignore serialization errors
    }
  }

  if (moleculerError.retryable !== undefined) {
    span.setAttribute('moleculer.error.retryable', moleculerError.retryable);
  }

  // Detect circuit breaker errors
  if (isCircuitBreakerError(error)) {
    span.setAttribute('moleculer.circuitBreaker.open', true);
    span.setAttribute('moleculer.circuitBreaker.error', true);
  }

  // Detect timeout errors
  if (isTimeoutError(error)) {
    span.setAttribute('moleculer.timeout.exceeded', true);
  }

  // Detect validation errors
  if (isValidationError(error)) {
    span.setAttribute('moleculer.validation.failed', true);
  }
}

/**
 * Check if error is a circuit breaker error
 */
function isCircuitBreakerError(error: Error): boolean {
  const name = error.constructor.name;
  const message = error.message.toLowerCase();
  return (
    name === 'BrokerCircuitBreakerOpenedError' ||
    name === 'CircuitBreakerOpenError' ||
    message.includes('circuit breaker') ||
    message.includes('circuit is open')
  );
}

/**
 * Check if error is a timeout error
 */
function isTimeoutError(error: Error): boolean {
  const name = error.constructor.name;
  const message = error.message.toLowerCase();
  return (
    name === 'RequestTimeoutError' ||
    name === 'TimeoutError' ||
    message.includes('timeout') ||
    message.includes('timed out')
  );
}

/**
 * Check if error is a validation error
 */
function isValidationError(error: Error): boolean {
  const name = error.constructor.name;
  return (
    name === 'ValidationError' ||
    name === 'ParameterValidationError' ||
    (error as MoleculerError).type === 'VALIDATION_ERROR'
  );
}

/**
 * Sets success status on a span.
 */
export function recordSuccess(span: Span): void {
  span.setStatus({ code: SpanStatusCode.OK });
}

/**
 * Moleculer error interface with additional properties
 */
interface MoleculerError extends Error {
  code?: number | string;
  type?: string;
  data?: unknown;
  retryable?: boolean;
}
