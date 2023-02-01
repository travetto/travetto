import fs from 'fs/promises';

import { path, RootIndex } from '@travetto/manifest';

import { ShutdownManager } from './shutdown';


export type FileWatchEvent = { action: 'create' | 'update' | 'delete', file: string };

/**
 * Allow for simple watching of files
 */
export class WatchUtil {
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  static async #getWatcher() {
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
   */
  static async buildWatcher(
    folders: string[],
    onEvent: (ev: FileWatchEvent, folder: string) => void,
    filter?: (ev: FileWatchEvent) => boolean
  ): Promise<() => Promise<void>> {
    const lib = await this.#getWatcher();
    const subs = await Promise.all(folders.map(async folder => {
      if (await fs.stat(folder).then(() => true, () => false)) {
        const ignore = (await fs.readdir(folder)).filter(x => x.startsWith('.') && x.length > 2);
        return lib.subscribe(folder, (err, events) => {
          for (const ev of events) {
            const finalEv = { action: ev.type, file: ev.path };
            if (!filter || filter(finalEv)) {
              onEvent(finalEv, folder);
            }
          }
        }, { ignore });
      }
    }));

    // Allow for multiple calls
    let finalProm: Promise<void> | undefined;
    const remove = (): Promise<void> => finalProm ??= Promise.all(subs.map(x => x?.unsubscribe())).then(() => { });

    // Remove on shut down
    ShutdownManager.onShutdown(this.constructor, remove);

    return remove;
  }

  /**
   * Watch compiled output in .js files
   */
  static async buildOutputWatcher(onEvent: (ev: FileWatchEvent, folder: string) => void): Promise<() => Promise<void>> {
    const localMods = RootIndex.getLocalModules();
    const folders = localMods.map(x => x.output);
    return this.buildWatcher(folders, onEvent, ev => ev.file.endsWith('.js'));
  }

  static async watchFile(source: string, onChange: () => void): Promise<() => Promise<void>> {
    return this.buildWatcher([path.dirname(source)], onChange, ev => ev.action === 'update' && ev.file === source);
  }
}