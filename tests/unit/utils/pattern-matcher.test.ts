import { describe, it, expect } from 'vitest';
import { shouldExclude } from '../../../src/utils/pattern-matcher';

describe('Pattern Matcher', () => {
  describe('shouldExclude', () => {
    it('should return false for empty patterns', () => {
      expect(shouldExclude('test.action', [])).toBe(false);
      expect(shouldExclude('test.action', undefined)).toBe(false);
    });

    it('should match exact names', () => {
      expect(shouldExclude('test.action', ['test.action'])).toBe(true);
      expect(shouldExclude('test.action', ['other.action'])).toBe(false);
    });

    it('should match wildcard patterns with *', () => {
      expect(shouldExclude('test.action', ['test.*'])).toBe(true);
      expect(shouldExclude('test.hello', ['test.*'])).toBe(true);
      expect(shouldExclude('other.action', ['test.*'])).toBe(false);
    });

    it('should match patterns with * in the middle', () => {
      expect(shouldExclude('users.get', ['*.get'])).toBe(true);
      expect(shouldExclude('posts.get', ['*.get'])).toBe(true);
      expect(shouldExclude('users.list', ['*.get'])).toBe(false);
    });

    it('should match patterns with multiple *', () => {
      expect(shouldExclude('a.b.c', ['*.*.*'])).toBe(true);
      expect(shouldExclude('x.y.z', ['*.*.*'])).toBe(true);
      expect(shouldExclude('a.b', ['*.*.*'])).toBe(false);
    });

    it('should match patterns with ?', () => {
      expect(shouldExclude('test1', ['test?'])).toBe(true);
      expect(shouldExclude('testA', ['test?'])).toBe(true);
      expect(shouldExclude('test12', ['test?'])).toBe(false);
    });

    it('should match $node.* internal actions', () => {
      expect(shouldExclude('$node.health', ['$node.*'])).toBe(true);
      expect(shouldExclude('$node.list', ['$node.*'])).toBe(true);
      expect(shouldExclude('users.list', ['$node.*'])).toBe(false);
    });

    it('should match with multiple patterns', () => {
      const patterns = ['$node.*', 'internal.*', 'test.debug'];

      expect(shouldExclude('$node.health', patterns)).toBe(true);
      expect(shouldExclude('internal.check', patterns)).toBe(true);
      expect(shouldExclude('test.debug', patterns)).toBe(true);
      expect(shouldExclude('users.get', patterns)).toBe(false);
    });
  });
});
