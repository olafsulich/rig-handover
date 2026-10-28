import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { readNight } from '../src/digest/reader.js';
import type { Night } from '../src/digest/types.js';

const lines = (...rows: object[]) => rows.map((r) => JSON.stringify(r)).join('\n') + '\n';

const NORMAL = '2026-10-28';
const EMPTY = '2026-10-27';
const BAD = '2026-10-26';
const MISSING = '2026-10-25';

let runsDir: string;

beforeAll(() => {
  runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
  // Out of job order on purpose; a null owner, and 3 retries followed by a fail.
  writeFileSync(
    join(runsDir, `${NORMAL}.jsonl`),
    lines(
      { at: '2026-10-28T23:00:06+01:00', job: 'lane/sync', status: 'ok', owner: 'rook' },
      { at: '2026-10-29T01:30:00+01:00', job: 'fixtures/refresh', status: 'retry', owner: 'rook', error: 'upstream 503' },
      { at: '2026-10-29T01:31:00+01:00', job: 'fixtures/refresh', status: 'retry', owner: 'rook', error: 'upstream 503' },
      { at: '2026-10-29T01:33:00+01:00', job: 'fixtures/refresh', status: 'retry', owner: 'rook', error: 'upstream 503' },
      { at: '2026-10-29T01:37:00+01:00', job: 'fixtures/refresh', status: 'fail', owner: 'rook', error: 'gave up' },
      { at: '2026-10-29T04:00:01+01:00', job: 'notes/backup', status: 'fail', owner: 'lane-07', error: 'quota exceeded' },
      { at: '2026-10-29T05:41:09+01:00', job: 'digest/render', status: 'ok', owner: null },
    ),
  );
  writeFileSync(join(runsDir, `${EMPTY}.jsonl`), '');
  writeFileSync(
    join(runsDir, `${BAD}.jsonl`),
    lines({ at: '2026-10-26T23:00:02+01:00', job: 'lane/sync', status: 'ok', owner: 'rook' }) +
      '{"at":"2026-10-26T23:30:00+01:00","job":"lane/sy\n',
  );
});

afterAll(() => {
  rmSync(runsDir, { recursive: true, force: true });
});

const app = () =>
  createApp({ adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir });

const page = (night: string) => app().request(`/digest/${night}`);
const json = (night: string) => app().request(`/api/digest/${night}`);

// Job names in the order they appear in the page, found by position of each name.
function pageOrder(html: string, jobs: string[]): string[] {
  return jobs
    .map((job) => ({ job, at: html.indexOf(job) }))
    .filter((x) => x.at >= 0)
    .sort((a, b) => a.at - b.at)
    .map((x) => x.job);
}

describe('GET /digest/:night', () => {
  it('answers 200 and lists every job, sorted by job', async () => {
    const res = await page(NORMAL);
    const html = await res.text();
    expect(res.status).toBe(200);
    const jobs = ['digest/render', 'fixtures/refresh', 'lane/sync', 'notes/backup'];
    for (const job of jobs) expect(html).toContain(job);
    expect(pageOrder(html, jobs)).toEqual(jobs);
  });

  it('renders a null owner as a dash', async () => {
    const html = await (await page(NORMAL)).text();
    expect(html).toContain('—');
  });

  it('marks a failing job with 3 or more retries as warn', async () => {
    const html = await (await page(NORMAL)).text();
    expect(html).toMatch(/class="[^"]*\bwarn\b/);
  });

  it('says nothing ran for an empty night', async () => {
    const res = await page(EMPTY);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('reports lines that could not be read', async () => {
    const res = await page(BAD);
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('lane/sync');
    expect(html).toMatch(/1 lines? in the log could not be read/);
  });

  it('does not mention unreadable lines when there are none', async () => {
    const html = await (await page(NORMAL)).text();
    expect(html).not.toContain('could not be read');
  });

  it('answers 404 for a night with no file', async () => {
    expect((await page(MISSING)).status).toBe(404);
  });

  it('answers 404 for a night that is not YYYY-MM-DD', async () => {
    expect((await page('tomorrow')).status).toBe(404);
    expect((await page('2026-10-2')).status).toBe(404);
  });
});

describe('GET /api/digest/:night', () => {
  it('answers 200 with the night exactly as readNight returns it', async () => {
    const res = await json(NORMAL);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(readNight(runsDir, NORMAL));
  });

  it('keeps a null owner and a null lastError as null', async () => {
    const body = (await (await json(NORMAL)).json()) as Night;
    const render = body.rows.find((r) => r.job === 'digest/render');
    expect(render?.owner).toBeNull();
    expect(render?.lastError).toBeNull();
  });

  it('gives no rows for an empty night', async () => {
    const res = await json(EMPTY);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ night: EMPTY, rows: [], badLines: 0 });
  });

  it('counts a bad line in badLines and keeps the good rows', async () => {
    const res = await json(BAD);
    const body = (await res.json()) as Night;
    expect(res.status).toBe(200);
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r) => r.job)).toEqual(['lane/sync']);
  });

  it('answers 404 with an error body for a night with no file', async () => {
    const res = await json(MISSING);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no run log', night: MISSING });
  });
});

describe('page and JSON agree', () => {
  it('list the same jobs in the same order', async () => {
    const body = (await (await json(NORMAL)).json()) as Night;
    const jobs = body.rows.map((r) => r.job);
    const html = await (await page(NORMAL)).text();
    expect(pageOrder(html, jobs)).toEqual(jobs);
  });

  it('agree on a night with a bad line', async () => {
    const body = (await (await json(BAD)).json()) as Night;
    const jobs = body.rows.map((r) => r.job);
    const html = await (await page(BAD)).text();
    expect(pageOrder(html, jobs)).toEqual(jobs);
    expect(html).toContain(`${body.badLines} line`);
  });
});
