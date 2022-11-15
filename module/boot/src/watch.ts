import { readdirSync } from 'fs';
import type * as watcher from '@parcel/watcher';

import { path } from '@travetto/common';

async function getWatcher(): Promise<typeof watcher> {
  try {
    return await import('@parcel/watcher');
  } catch (err) {
    console.error('@parcel/watcher must be installed to use watching functionality');
    throw err;
  }
}

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
    onEvent: (ev: { type: 'create' | 'update' | 'delete', path: string }, folder: string) => void
  ): Promise<() => Promise<void>> {
    const lib = await getWatcher();
    const subs = await Promise.all(folders.map(folder =>
      lib.subscribe(folder, (err, events) => {
        for (const ev of events) {
          onEvent(ev, folder);
        }
      }, {
        ignore: [...readdirSync(folder).filter(x => x.startsWith('.') && x.length > 2), 'node_modules']
      })
    ));
    return () => Promise.all(subs.map(x => x.unsubscribe())).then(() => { });
  }

  static async watchFile(
    source: string,
    onChange: () => void
  ): Promise<() => Promise<void>> {
    return this.buildWatcher(
      [path.dirname(source)],
      ({ type, path: file }) => {
        if (type === 'update' && file === source) {
          onChange();
        }
      }
    );
  }
}