import { statSync } from 'node:fs';

import { path } from '@travetto/manifest';

import { AsyncQueue } from '../../support/queue';

export type WatchEvent = { action: 'create' | 'update' | 'delete', file: string };

const CREATE_THRESHOLD = 50;

/** Watch files */
export async function* fileWatchEvents(rootPath: string, signal: AbortSignal): AsyncIterable<
  WatchEvent | Error
> {
  const q = new AsyncQueue<WatchEvent | Error>(signal);
  const lib = await import('@parcel/watcher');

  const cleanup = await lib.subscribe(rootPath, (err, events) => {
    if (err) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      q.add(err instanceof Error ? err : new Error((err as Error).message));
      return;
    }

    for (const ev of events) {
      const finalEv = { action: ev.type, file: path.toPosix(ev.path) };
      if (ev.type !== 'delete') {
        const stats = statSync(finalEv.file);
        if ((Date.now() - stats.ctimeMs) < CREATE_THRESHOLD) {
          finalEv.action = 'create'; // Force create on newly stated files
        }
      }
      q.add(finalEv);
    }
  }, {
    ignore: ['node_modules', '**/node_modules', '.git', '**/.git']
  });

  signal.addEventListener('abort', () => cleanup.unsubscribe());

  yield* q;
}