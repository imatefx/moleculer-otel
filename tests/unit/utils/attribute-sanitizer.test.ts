import { describe, it, expect } from 'vitest';
import {
  sanitizeAttributeValue,
  truncateValue,
  flattenObject,
  pickKeys,
} from '../../../src/utils/attribute-sanitizer';

describe('Attribute Sanitizer', () => {
  describe('sanitizeAttributeValue', () => {
    it('should return undefined for null and undefined', () => {
      expect(sanitizeAttributeValue(null)).toBeUndefined();
      expect(sanitizeAttributeValue(undefined)).toBeUndefined();
    });

    it('should pass through strings', () => {
      expect(sanitizeAttributeValue('hello')).toBe('hello');
    });

    it('should truncate long strings', () => {
      const longString = 'a'.repeat(2000);
      const result = sanitizeAttributeValue(longString, 100);
      expect(result).toHaveLength(100);
      expect((result as string).endsWith('...')).toBe(true);
    });

    it('should pass through numbers', () => {
      expect(sanitizeAttributeValue(42)).toBe(42);
      expect(sanitizeAttributeValue(3.14)).toBe(3.14);
    });

    it('should convert NaN and Infinity to strings', () => {
      expect(sanitizeAttributeValue(NaN)).toBe('NaN');
      expect(sanitizeAttributeValue(Infinity)).toBe('Infinity');
      expect(sanitizeAttributeValue(-Infinity)).toBe('-Infinity');
    });

    it('should pass through booleans', () => {
      expect(sanitizeAttributeValue(true)).toBe(true);
      expect(sanitizeAttributeValue(false)).toBe(false);
    });

    it('should handle homogeneous arrays', () => {
      expect(sanitizeAttributeValue(['a', 'b', 'c'])).toEqual(['a', 'b', 'c']);
      expect(sanitizeAttributeValue([1, 2, 3])).toEqual([1, 2, 3]);
      expect(sanitizeAttributeValue([true, false])).toEqual([true, false]);
    });

    it('should convert mixed arrays to JSON', () => {
      const result = sanitizeAttributeValue([1, 'two', true]);
      expect(typeof result).toBe('string');
      expect(result).toBe('[1,"two",true]');
    });

    it('should serialize objects to JSON', () => {
      const result = sanitizeAttributeValue({ foo: 'bar' });
      expect(result).toBe('{"foo":"bar"}');
    });

    it('should handle circular references gracefully', () => {
      const obj: Record<string, unknown> = { a: 1 };
      obj.self = obj;
      const result = sanitizeAttributeValue(obj);
      expect(result).toBe('[Circular or non-serializable object]');
    });
  });

  describe('truncateValue', () => {
    it('should not truncate short strings', () => {
      expect(truncateValue('hello', 10)).toBe('hello');
    });

    it('should truncate long strings with ellipsis', () => {
      expect(truncateValue('hello world', 8)).toBe('hello...');
    });

    it('should handle exact length', () => {
      expect(truncateValue('hello', 5)).toBe('hello');
    });
  });

  describe('flattenObject', () => {
    it('should flatten nested objects', () => {
      const obj = {
        user: {
          name: 'John',
          age: 30,
        },
        active: true,
      };

      const result = flattenObject(obj);

      expect(result['user.name']).toBe('John');
      expect(result['user.age']).toBe(30);
      expect(result['active']).toBe(true);
    });

    it('should handle deeply nested objects', () => {
      const obj = {
        a: {
          b: {
            c: 'value',
          },
        },
      };

      const result = flattenObject(obj);
      expect(result['a.b.c']).toBe('value');
    });

    it('should handle arrays', () => {
      const obj = {
        tags: ['a', 'b', 'c'],
      };

      const result = flattenObject(obj);
      expect(result['tags']).toEqual(['a', 'b', 'c']);
    });

    it('should respect max depth', () => {
      const obj = {
        a: { b: { c: { d: { e: { f: 'deep' } } } } },
      };

      const result = flattenObject(obj, 1024, '', 3);
      expect(result['a.b.c']).toBeUndefined();
    });
  });

  describe('pickKeys', () => {
    it('should pick specific keys', () => {
      const obj = {
        id: '123',
        name: 'John',
        password: 'secret',
      };

      const result = pickKeys(obj, ['id', 'name']);

      expect(result['id']).toBe('123');
      expect(result['name']).toBe('John');
      expect(result['password']).toBeUndefined();
    });

    it('should support nested keys with dot notation', () => {
      const obj = {
        user: {
          id: '123',
          profile: {
            name: 'John',
          },
        },
      };

      const result = pickKeys(obj, ['user.id', 'user.profile.name']);

      expect(result['user.id']).toBe('123');
      expect(result['user.profile.name']).toBe('John');
    });

    it('should skip missing keys', () => {
      const obj = { a: 1 };
      const result = pickKeys(obj, ['a', 'b', 'c']);

      expect(result['a']).toBe(1);
      expect(result['b']).toBeUndefined();
      expect(result['c']).toBeUndefined();
    });
  });
});
