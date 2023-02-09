import fs from 'fs/promises';

import { path, RootIndex } from '@travetto/manifest';

export type ManifestWatchEvent = { action: 'create' | 'update' | 'delete', file: string };

type EventListener = (ev: ManifestWatchEvent, folder: string) => void;
type EventFilter = (ev: ManifestWatchEvent) => boolean;
type WatchConfig = {
  filter?: EventFilter;
  ignore?: string[];
};

/**
 * Allow for simple watching of files
 */
export class ManifestWatcher {
  static async #getWatcher(): Promise<typeof import('@parcel/watcher')> {
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
  static async buildWatcher(folders: string[], onEvent: EventListener, config: WatchConfig = {}): Promise<() => Promise<void>> {
    const lib = await this.#getWatcher();
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

  /**
   * Watch output .js files for a given manifest
   */
  static async watchOutput(onEvent: EventListener): Promise<() => Promise<void>> {
    const localMods = RootIndex.getLocalModules();
    const folders = localMods.map(x => x.outputPath);
    return this.buildWatcher(folders, onEvent, { filter: ev => ev.file.endsWith('.js') });
  }

  /**
   * Watch input .ts files for the given manifest
   * @param onEvent
   * @returns
   */
  static async watchInput(onEvent: EventListener): Promise<() => Promise<void>> {
    const folders = RootIndex.getLocalModules()
      .flatMap(x =>
        (!RootIndex.manifest.monoRepo || x.sourcePath !== RootIndex.manifest.workspacePath) ?
          [x.sourcePath] : [...Object.keys(x.files)].filter(y => !y.startsWith('$')).map(y => path.resolve(x.sourcePath, y))
      );
    return this.buildWatcher(folders, onEvent, {
      filter: ev => ev.file.endsWith('.ts'),
      ignore: ['node_modules']
    });
  }

  /**
   * Watch a single file or import
   */
  static async watchInputFile(fileOrImport: string, onChange: () => void): Promise<() => Promise<void>> {
    const entry = RootIndex.getEntry(fileOrImport) ?? RootIndex.getFromImport(fileOrImport);
    const source = entry!.sourceFile;
    return this.buildWatcher([path.dirname(source)], onChange, {
      filter: ev => ev.action === 'update' && ev.file === source
    });
  }
}