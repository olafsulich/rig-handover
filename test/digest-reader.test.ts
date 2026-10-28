import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/reader.js';

const temps: string[] = [];
function tempRuns(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  temps.push(dir);
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
  return dir;
}

afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('readNight on runs/2026-10-28.jsonl', () => {
  const night = readNight('runs', '2026-10-28');

  it('reads 5 jobs and 1 bad line (the truncated last line)', () => {
    expect(night).not.toBeNull();
    expect(night?.night).toBe('2026-10-28');
    expect(night?.rows).toHaveLength(5);
    expect(night?.badLines).toBe(1);
  });

  it('builds the concrete rows, sorted by job, keeping the log offsets', () => {
    expect(night?.rows).toEqual([
      {
        job: 'digest/render',
        owner: null,
        runs: 1,
        retries: 0,
        lastStatus: 'ok',
        lastError: null,
        firstAt: '2026-10-29T05:41:09+01:00',
        lastAt: '2026-10-29T05:41:09+01:00',
      },
      {
        job: 'fixtures/refresh',
        owner: 'rook',
        runs: 4,
        retries: 3,
        lastStatus: 'ok',
        lastError: null,
        firstAt: '2026-10-29T01:30:00+01:00',
        lastAt: '2026-10-29T01:37:00+01:00',
      },
      {
        job: 'lane/sync',
        owner: 'rook',
        runs: 8,
        retries: 1,
        lastStatus: 'ok',
        lastError: null,
        firstAt: '2026-10-28T23:00:06+01:00',
        lastAt: '2026-10-29T05:00:04+01:00',
      },
      {
        job: 'notes/backup',
        owner: 'lane-07',
        runs: 1,
        retries: 0,
        lastStatus: 'fail',
        lastError: 'quota exceeded',
        firstAt: '2026-10-29T04:00:01+01:00',
        lastAt: '2026-10-29T04:00:01+01:00',
      },
      {
        job: 'rig/rotate-logs',
        owner: 'lane-07',
        runs: 1,
        retries: 0,
        lastStatus: 'ok',
        lastError: null,
        firstAt: '2026-10-28T23:00:02+01:00',
        lastAt: '2026-10-28T23:00:02+01:00',
      },
    ]);
  });
});

describe('readNight edge cases', () => {
  it('returns null for a night with no file', () => {
    expect(readNight(tempRuns({}), '2026-01-01')).toBeNull();
  });

  it('gives no rows for an empty file', () => {
    expect(readNight(tempRuns({ '2026-01-02.jsonl': '' }), '2026-01-02')).toEqual({
      night: '2026-01-02',
      rows: [],
      badLines: 0,
    });
  });

  it('counts wrong-shaped lines as bad, skips blank lines, and takes the last owner', () => {
    const body = [
      '{"at":"2026-01-03T01:00:00+02:00","job":"a","status":"retry","owner":"x","error":"boom"}',
      '',
      '{"at":"2026-01-03T02:00:00+02:00","job":"a","status":"ok","owner":"y"}',
      '{"at":"2026-01-03T03:00:00+02:00","job":"b","status":"maybe","owner":"x"}',
      '{"at":"2026-01-03T03:00:00+02:00","job":"b","status":"ok"}',
      '[1,2]',
      'not json',
      '',
    ].join('\n');
    const night = readNight(tempRuns({ '2026-01-03.jsonl': body }), '2026-01-03');
    expect(night?.badLines).toBe(4);
    expect(night?.rows).toEqual([
      {
        job: 'a',
        owner: 'y',
        runs: 2,
        retries: 1,
        lastStatus: 'ok',
        lastError: null,
        firstAt: '2026-01-03T01:00:00+02:00',
        lastAt: '2026-01-03T02:00:00+02:00',
      },
    ]);
  });
});
