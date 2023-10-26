import { watch, Stats } from 'fs';
import fs from 'fs/promises';

import { path } from '@travetto/manifest';

import { AsyncQueue } from '../../support/queue';

export type WatchEvent = { action: 'create' | 'update' | 'delete', file: string, folder: string };

export type WatchFolder = {
  /**
   * Source folder
   */
  src: string;
  /**
   * Target folder name, useful for deconstructing
   */
  target?: string;
  /**
   * Filter events
   */
  filter?: (ev: WatchEvent) => boolean;
  /**
   * Only look at immediate folder
   */
  immediate?: boolean;
  /**
   * List of top level folders to ignore
   */
  ignore?: string[];
  /**
   * If watching a folder that doesn't exist, should it be created?
   */
  createMissing?: boolean;
  /**
   * Include files that start with '.'
   */
  includeHidden?: boolean;
};

export type WatchStream = AsyncIterable<WatchEvent> & { close: () => Promise<void>, add: (item: WatchEvent | WatchEvent[]) => void };

const DEDUPE_THRESHOLD = 50;

/**
 * Watch immediate files for a given folder
 */
async function watchFolderImmediate(queue: AsyncQueue<WatchEvent>, options: WatchFolder): Promise<void> {
  const watchPath = path.resolve(options.src);
  const watcher = watch(watchPath, { persistent: true, encoding: 'utf8' });
  const lastStats: Record<string, Stats | undefined> = {};
  const invalidFilter = (el: string): boolean =>
    (el === '.' || el === '..' || (!options.includeHidden && el.startsWith('.')) || !!options.ignore?.includes(el));

  for (const el of await fs.readdir(watchPath)) {
    if (invalidFilter(el)) {
      continue;
    }
    const file = path.resolve(watchPath, el);
    lastStats[file] = await fs.stat(file);
  }

  const target = options.target ?? options.src;

  watcher.on('change', async (type: string, file: string): Promise<void> => {
    if (invalidFilter(file)) {
      return;
    }

    file = path.resolve(watchPath, file);

    const stat = await fs.stat(file).catch(() => undefined);
    const prevStat = lastStats[file];
    lastStats[file] = stat;

    if (prevStat?.mtimeMs === stat?.mtimeMs) {
      return;
    }
    let ev: WatchEvent;
    if (prevStat && !stat) {
      ev = { action: 'delete', file, folder: target };
    } else if (!prevStat && stat) {
      ev = { action: 'create', file, folder: target };
    } else {
      ev = { action: 'update', file, folder: target };
    }
    if (!options.filter || options.filter(ev)) {
      queue.add(ev);
    }
  });

  queue.onClose().then(() => watcher.close());
}

/**
 * Watch recursive files for a given folder
 */
async function watchFolderRecursive(queue: AsyncQueue<WatchEvent>, options: WatchFolder): Promise<void> {
  const lib = await import('@parcel/watcher');
  const target = options.target ?? options.src;

  if (await fs.stat(options.src).then(() => true, () => options.createMissing)) {
    await fs.mkdir(options.src, { recursive: true });
    const ignore = (await fs.readdir(options.src)).filter(x => x.startsWith('.') && x.length > 2);
    const cleanup = await lib.subscribe(options.src, async (err, events) => {
      if (err) {
        process.send?.({ type: 'log', message: `Watch error: ${err}` });
      }
      for (const ev of events) {
        const finalEv = { action: ev.type, file: path.toPosix(ev.path), folder: target };
        if (ev.type !== 'delete') {
          const stats = await fs.stat(finalEv.file);
          if ((stats.ctimeMs - Date.now()) < DEDUPE_THRESHOLD) {
            ev.type = 'create'; // Force create on newly stated files
          }
        }

        if (ev.type === 'delete' && finalEv.file === options.src) {
          return queue.close();
        }
        const isHidden = !options.includeHidden && finalEv.file.replace(target, '').includes('/.');
        const matches = !isHidden && (!options.filter || options.filter(finalEv));
        if (matches) {
          queue.add(finalEv);
        }
      }
    }, { ignore: [...ignore, ...options.ignore ?? []] });
    queue.onClose().then(() => cleanup.unsubscribe());
  }
}

/**
 * Watch a series of folders
 * @param folders
 * @param onEvent
 * @param options
 */
export function watchFolders(
  folders: WatchFolder[],
  config: Omit<WatchFolder, 'src' | 'target'> = {}
): AsyncQueue<WatchEvent> {
  const queue = new AsyncQueue<WatchEvent>();
  for (const folder of folders) {
    if (!folder.immediate) {
      watchFolderRecursive(queue, { ...config, ...folder });
    } else {
      watchFolderImmediate(queue, { ...config, ...folder });
    }
  }
  return queue;
}