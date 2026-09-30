import { describe, expect, it } from 'vitest';
import { formatKr, kr } from '../src/money';

describe('kr', () => {
  it('converts kronor to integer öre', () => {
    expect(kr(2490)).toBe(249000);
    expect(kr(29)).toBe(2900);
  });

  it('rounds to whole öre', () => {
    expect(kr(0.106)).toBe(11);
  });
});

describe('formatKr', () => {
  it('formats öre as Swedish kronor', () => {
    // sv-SE uses non-breaking spaces; \s matches them
    expect(formatKr(249000, 'sv')).toMatch(/^2\s490\skr$/);
  });

  it('shows öre only when needed', () => {
    expect(formatKr(85950, 'sv')).toMatch(/^859,50\skr$/);
  });
});
