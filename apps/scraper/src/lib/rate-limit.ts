import PQueue from 'p-queue';

export interface HostLimit {
  intervalMs: number;
  intervalCap: number;
  concurrency: number;
}

const queues = new Map<string, PQueue>();

export function getHostQueue(host: string, limit: HostLimit): PQueue {
  let q = queues.get(host);
  if (!q) {
    q = new PQueue({
      concurrency: limit.concurrency,
      interval: limit.intervalMs,
      intervalCap: limit.intervalCap,
      carryoverConcurrencyCount: true,
    });
    queues.set(host, q);
  }
  return q;
}

export const DEFAULT_HOST_LIMIT: HostLimit = {
  intervalMs: 1_000,
  intervalCap: 1,
  concurrency: 1,
};
