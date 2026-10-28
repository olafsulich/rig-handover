// Plan morning-digest § 1. The shape every part of § 2 builds against; the reader lives next to it.

export type RunStatus = 'ok' | 'retry' | 'fail';

// One line of runs/<night>.jsonl.
export type RunLine = {
  at: string;
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

// One row per job in a night. Times keep the log's offset (styleguide).
export type DigestRow = {
  job: string;
  owner: string | null; // null renders as '—'
  runs: number;
  retries: number;
  lastStatus: RunStatus;
  lastError: string | null; // error of the job's last line; null renders as '—'
  firstAt: string;
  lastAt: string;
};

// A night as read from disk: rows sorted by job, and how many lines didn't parse.
export type Night = {
  night: string; // YYYY-MM-DD
  rows: DigestRow[];
  badLines: number;
};

// Reads runs/<night>.jsonl. Returns null when the night has no file; an empty file gives no rows.
// A line that doesn't parse is counted in badLines, never thrown.
export type ReadNight = (runsDir: string, night: string) => Night | null;
