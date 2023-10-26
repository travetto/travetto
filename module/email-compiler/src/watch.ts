import fs from 'fs/promises';

import { path } from '@travetto/manifest';
import { ManualAsyncIterator as Queue } from '@travetto/worker';

type WatchEvent = { action: 'create' | 'update' | 'delete', file: string, folder: string };

const DEDUPE_THRESHOLD = 50;

/**
 * Watch recursive files for a given folder
 */
async function watchFolderRecursive(queue: Queue<WatchEvent>, src: string): Promise<void> {
  const lib = await import('@parcel/watcher');

  if (!await fs.stat(src).then(() => true, () => false)) {
    return;
  }

  const ignore = (await fs.readdir(src)).filter(x => x.startsWith('.') && x.length > 2);
  const cleanup = await lib.subscribe(src, async (err, events) => {
    for (const ev of events) {
      const finalEv = { action: ev.type, file: path.toPosix(ev.path), folder: src };
      if (ev.type !== 'delete') {
        const stats = await fs.stat(finalEv.file);
        if ((stats.ctimeMs - Date.now()) < DEDUPE_THRESHOLD) {
          ev.type = 'create'; // Force create on newly stated files
        }
      }

      if (ev.type === 'delete' && finalEv.file === src) {
        return queue.close();
      }

      if (!finalEv.file.replace(src, '').includes('/.')) {
        queue.add(finalEv);
      }
    }
  }, { ignore });

  queue.onClose().then(() => cleanup.unsubscribe());
}

/**
 * Watch folders as needed
 */
export async function watchFolders(folders: string[]): Promise<Queue<WatchEvent>> {
  const q = new Queue<WatchEvent>();
  for (const folder of folders) {
    await watchFolderRecursive(q, folder); // Start each watcher
  }
  return q;
}