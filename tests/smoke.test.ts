import { describe, it, expect } from 'vitest';

describe('toolchain', () => {
  it('runs tests', () => {
    expect(1 + 1).toBe(2);
  });
  it('has web crypto available', () => {
    expect(typeof crypto.subtle.digest).toBe('function');
  });
});
