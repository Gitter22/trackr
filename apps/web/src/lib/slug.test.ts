import { describe, expect, it } from 'vitest';
import { SLUG_RE, slugify } from './slug';

describe('slugify', () => {
  it.each([
    ['Kiksasa', 'kiksasa'],
    ['Kiksasa Labs!', 'kiksasa-labs'],
    ['  2024 Acme  ', 'acme'],
    ['Café Ünïcode', 'cafe-unicode'],
  ])('%s -> %s', (title, slug) => {
    expect(slugify(title)).toBe(slug);
    expect(SLUG_RE.test(slug)).toBe(true);
  });
});
