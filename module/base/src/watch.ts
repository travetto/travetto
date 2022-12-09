import { readdirSync } from 'fs';
import type * as watcher from '@parcel/watcher';

import { ShutdownManager } from '@travetto/base';
import { path } from '@travetto/manifest';

async function getWatcher(): Promise<typeof watcher> {
  try {
    return await import('@parcel/watcher');
  } catch (err) {
    console.error('@parcel/watcher must be installed to use watching functionality');
    throw err;
  }
}

export type FileWatchEvent = { type: 'create' | 'update' | 'delete', path: string };

/**
 * Allow for simple watching of files
 */
export class WatchUtil {
  /**
   * Leverages @parcel/watcher to watch a series of folders
   * @param folders
   * @param onEvent
   */
  static async buildWatcher(
    folders: string[],
    onEvent: (ev: FileWatchEvent, folder: string) => void,
    filter?: (ev: FileWatchEvent) => boolean
  ): Promise<() => Promise<void>> {
    const lib = await getWatcher();
    const subs = await Promise.all(folders.map(folder =>
      lib.subscribe(folder, (err, events) => {
        for (const ev of events) {
          if (!filter || filter(ev)) {
            onEvent(ev, folder);
          }
        }
      }, {
        ignore: [
          ...readdirSync(folder).filter(x => x.startsWith('.') && x.length > 2)
        ]
      })
    ));

    // Allow for multiple calls
    let finalProm: Promise<void> | undefined;
    const remove = (): Promise<void> => finalProm ??= Promise.all(subs.map(x => x.unsubscribe())).then(() => { });

    // Remove on shut down
    ShutdownManager.onShutdown(this.constructor, remove);

    return remove;
  }

  static async watchFile(source: string, onChange: () => void): Promise<() => Promise<void>> {
    return this.buildWatcher([path.dirname(source)], onChange, ev => ev.type === 'update' && ev.path === source);
  }
}