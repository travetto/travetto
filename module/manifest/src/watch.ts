import fs from 'fs/promises';

export type WatchEvent = { action: 'create' | 'update' | 'delete', file: string };

type EventListener = (ev: WatchEvent, folder: string) => void;
type EventFilter = (ev: WatchEvent) => boolean;
type WatchConfig = { filter?: EventFilter, ignore?: string[] };

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
export async function watchFolders(folders: string[], onEvent: EventListener, config: WatchConfig = {}): Promise<() => Promise<void>> {
  const lib = await getWatcher();
  const subs = await Promise.all(folders.map(async folder => {
    if (await fs.stat(folder).then(() => true, () => false)) {
      const ignore = (await fs.readdir(folder)).filter(x => x.startsWith('.') && x.length > 2);
      return lib.subscribe(folder, (err, events) => {
        for (const ev of events) {
          const finalEv = { action: ev.type, file: ev.path };
          if (!config.filter || config.filter(finalEv)) {
            onEvent(finalEv, folder);
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