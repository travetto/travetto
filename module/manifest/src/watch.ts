import { watch, Stats } from 'fs';
import fs from 'fs/promises';
import { path } from './path';

async function getWatcher(): Promise<typeof import('@parcel/watcher')> {
  try {
    return await import('@parcel/watcher');
  } catch (err) {
    console.error('@parcel/watcher must be installed to use watching functionality');
    throw err;
  }
}

export type WatchEvent = { action: 'create' | 'update' | 'delete', file: string };
export type WatchEventFilter = (ev: WatchEvent) => boolean;

export type WatchEventListener = (ev: WatchEvent, folder: string) => void;
export type WatchConfig = {
  /**
   * Predicate for filtering events
   */
  filter?: WatchEventFilter;
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

/**
 * Watch files for a given folder
 * @param folder
 * @param onEvent
 * @param options
 */
export async function watchFolderImmediate(
  folder: string,
  onEvent: WatchEventListener,
  options: WatchConfig = {}
): Promise<() => Promise<void>> {
  const watchPath = path.resolve(folder);
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
      ev = { action: 'delete', file };
    } else if (!prevStat && stat) {
      ev = { action: 'create', file };
    } else {
      ev = { action: 'update', file };
    }
    if (!options.filter || options.filter(ev)) {
      onEvent(ev, folder);
    }
  });
  process.on('exit', () => watcher.close());
  return async () => watcher.close();
}

/**
 * Leverages @parcel/watcher to watch a series of folders
 * @param folders
 * @param onEvent
 * @param options
 */
export async function watchFolders(
  folders: string[] | [folder: string, targetFolder: string][] | (readonly [folder: string, targetFolder: string])[],
  onEvent: WatchEventListener,
  config: WatchConfig = {}
): Promise<() => Promise<void>> {
  const lib = await getWatcher();
  const createMissing = config.createMissing ?? false;
  const validFolders = new Set(folders.map(x => typeof x === 'string' ? x : x[0]));

  const subs = await Promise.all(folders.map(async value => {
    const folder = typeof value === 'string' ? value : value[0];
    const targetFolder = typeof value === 'string' ? value : value[1];

    if (await fs.stat(folder).then(() => true, () => createMissing)) {
      await fs.mkdir(folder, { recursive: true });
      const ignore = (await fs.readdir(folder)).filter(x => x.startsWith('.') && x.length > 2);
      return lib.subscribe(folder, (err, events) => {
        for (const ev of events) {
          const finalEv = { action: ev.type, file: path.toPosix(ev.path) };
          if (ev.type === 'delete' && validFolders.has(finalEv.file)) {
            return process.exit(0); // Exit when watched folder is removed
          }
          const isHidden = !config.includeHidden && finalEv.file.replace(targetFolder, '').includes('/.');
          const matches = !isHidden && (!config.filter || config.filter(finalEv));
          if (matches) {
            onEvent(finalEv, targetFolder);
          }
        }
      }, { ignore: [...ignore, ...config.ignore ?? []] });
    }
  }));

  // Allow for multiple calls
  let finalProm: Promise<void> | undefined;
  const remove = (): Promise<void> => finalProm ??= Promise.all(subs.map(x => x?.unsubscribe())).then(() => { });

  // Cleanup on exit
  process.on('exit', remove);

  return remove;
}