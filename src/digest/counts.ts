// Plan morning-digest § 2c. Per-line status counts for one night (not per job).

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseLine } from './reader.js';
import type { RunStatus } from './types.js';

export type NightCounts = Record<RunStatus, number>;

// Returns null when the night has no readable file. Lines that don't parse are skipped.
export function countNight(runsDir: string, night: string): NightCounts | null {
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch {
    return null;
  }
  const counts: NightCounts = { ok: 0, retry: 0, fail: 0 };
  for (const raw of text.split('\n')) {
    if (raw.trim() === '') continue;
    const line = parseLine(raw);
    if (line !== null) counts[line.status]++;
  }
  return counts;
}
