import fs from 'fs/promises';
import { path } from './path';

export type WatchEvent = { action: 'create' | 'update' | 'delete', file: string };

export type WatchEventListener = (ev: WatchEvent, folder: string) => void;
type EventFilter = (ev: WatchEvent) => boolean;
type WatchConfig = { filter?: EventFilter, ignore?: string[], createMissing?: boolean, includeHidden?: boolean };

async function getWatcher(): Promise<typeof import('@parcel/watcher')> {
  try {
    return await import('@parcel/watcher');
  } catch (err) {
    console.error('@parcel/watcher must be installed to use watching functionality');
    throw err;
  }
}

/**
 * Leverages @parcel/watcher to watch a series of folders
 * @param folders
 * @param onEvent
 * @private
 */
export async function watchFolders(
  folders: string[] | [folder: string, targetFolder: string][],
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