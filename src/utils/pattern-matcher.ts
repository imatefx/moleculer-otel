/**
 * Converts a glob pattern to a regular expression.
 * Supports * (any characters) and ? (single character).
 */
function globToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape special regex chars
    .replace(/\*/g, '.*') // * matches any characters
    .replace(/\?/g, '.'); // ? matches single character

  return new RegExp(`^${escaped}$`);
}

/**
 * Checks if a name matches any of the exclusion patterns.
 *
 * @param name - The action or event name to check
 * @param patterns - Array of glob patterns to match against
 * @returns true if the name should be excluded
 */
export function shouldExclude(name: string, patterns?: string[]): boolean {
  if (!patterns || patterns.length === 0) {
    return false;
  }

  return patterns.some((pattern) => {
    // Exact match
    if (pattern === name) {
      return true;
    }

    // Glob pattern match
    if (pattern.includes('*') || pattern.includes('?')) {
      return globToRegex(pattern).test(name);
    }

    return false;
  });
}
