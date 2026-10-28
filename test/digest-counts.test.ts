import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { countNight } from '../src/digest/counts.js';

describe('countNight', () => {
  it('counts parsed lines by status and skips the truncated one', () => {
    const lines = readFileSync('runs/2026-10-28.jsonl', 'utf8').split('\n').filter((l) => l.trim() !== '');
    const n = lines.length - 1; // last line is truncated
    const c = countNight('runs', '2026-10-28');
    expect(c).not.toBeNull();
    expect((c?.ok ?? 0) + (c?.retry ?? 0) + (c?.fail ?? 0)).toBe(n);
  });
  it('returns null for a missing night', () => {
    expect(countNight('runs', '1999-01-01')).toBeNull();
  });
});
