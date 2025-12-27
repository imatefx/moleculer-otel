import type { AttributeValue } from '@opentelemetry/api';

/**
 * Sanitizes a value for use as an OpenTelemetry span attribute.
 * OTEL attributes support: string, number, boolean, or arrays of these.
 */
export function sanitizeAttributeValue(
  value: unknown,
  maxLength = 1024
): AttributeValue | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value === 'string') {
    return truncateValue(value, maxLength);
  }

  if (typeof value === 'number') {
    // Handle NaN and Infinity
    if (!Number.isFinite(value)) {
      return String(value);
    }
    return value;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    // OTEL supports homogeneous arrays
    const sanitized = value
      .map((v) => sanitizeArrayElement(v, maxLength))
      .filter((v): v is string | number | boolean => v !== undefined);

    if (sanitized.length === 0) return undefined;

    // Check if all values are of the same type
    const firstType = typeof sanitized[0];
    if (sanitized.every((v) => typeof v === firstType)) {
      return sanitized as string[] | number[] | boolean[];
    }

    // Mixed types - convert to JSON string
    return truncateValue(JSON.stringify(value), maxLength);
  }

  // Objects - serialize to JSON
  try {
    return truncateValue(JSON.stringify(value), maxLength);
  } catch {
    return '[Circular or non-serializable object]';
  }
}

/**
 * Sanitizes an array element, returning primitive types only
 */
function sanitizeArrayElement(
  value: unknown,
  maxLength: number
): string | number | boolean | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value === 'string') {
    return truncateValue(value, maxLength);
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return String(value);
    }
    return value;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  // Convert complex types to string
  try {
    return truncateValue(JSON.stringify(value), maxLength);
  } catch {
    return '[Complex object]';
  }
}

/**
 * Truncates a string value to a maximum length.
 */
export function truncateValue(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return value.slice(0, maxLength - 3) + '...';
}

/**
 * Flattens a nested object for span attributes using dot notation.
 */
export function flattenObject(
  obj: Record<string, unknown>,
  maxLength = 1024,
  prefix = '',
  maxDepth = 5,
  currentDepth = 0
): Record<string, AttributeValue> {
  const result: Record<string, AttributeValue> = {};

  if (currentDepth >= maxDepth) {
    return result;
  }

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(
        result,
        flattenObject(
          value as Record<string, unknown>,
          maxLength,
          fullKey,
          maxDepth,
          currentDepth + 1
        )
      );
    } else {
      const sanitized = sanitizeAttributeValue(value, maxLength);
      if (sanitized !== undefined) {
        result[fullKey] = sanitized;
      }
    }
  }

  return result;
}

/**
 * Picks specific keys from an object (supports dot notation for nested access).
 */
export function pickKeys(
  obj: Record<string, unknown>,
  keys: string[],
  maxLength = 1024
): Record<string, AttributeValue> {
  const result: Record<string, AttributeValue> = {};

  for (const key of keys) {
    const value = getNestedValue(obj, key);
    if (value !== undefined) {
      const sanitized = sanitizeAttributeValue(value, maxLength);
      if (sanitized !== undefined) {
        result[key] = sanitized;
      }
    }
  }

  return result;
}

/**
 * Gets a nested value using dot notation (e.g., "user.id").
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((current: unknown, key: string) => {
    if (current && typeof current === 'object') {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}
