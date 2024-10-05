import fs from 'node:fs/promises';
import { watch } from 'node:fs';

import { type ManifestContext, ManifestFileUtil, ManifestIndex, ManifestModule, ManifestModuleUtil, ManifestUtil, PackageUtil, path } from '@travetto/manifest';

import { CompilerReset, type CompilerWatchEvent } from './types';
import { CompilerState } from './state';
import { CompilerUtil } from './util';

import { AsyncQueue } from '../support/queue';
import { IpcLogger } from '../support/log';

const log = new IpcLogger({ level: 'debug' });

type WatchEvent = Omit<CompilerWatchEvent, 'entry'>;
type ModuleFileMap = Map<string, { context: ManifestContext, events: CompilerWatchEvent[] }>;

const ROOT_PACKAGE_FILES = new Set(['package-lock.json', 'yarn.lock', 'package.json']);

export class CompilerWatcher {

  static #ignoreCache: Record<string, string[]> = {};

  /** Check for staleness */
  static async checkWatchStaleness(ctx: ManifestContext, lastWrite: number): Promise<number | undefined> {
    let maxTimestamp = 0;
    const manifest = await ManifestModuleUtil.produceModules(ctx);
    for (const mod of Object.values(manifest)) {
      for (const file of Object.values(mod.files)) {
        for (const [, , timestamp,] of file) {
          maxTimestamp = Math.max(timestamp, maxTimestamp);
          if (maxTimestamp > lastWrite) {
            return maxTimestamp;
          }
        }
      }
    }
  }

  /** Get standard set of watch ignores */
  static async getWatchIgnores(root: string): Promise<string[]> {
    if (this.#ignoreCache[root]) {
      return this.#ignoreCache[root];
    }

    const pkg = PackageUtil.readPackage(root);
    const patterns = [
      ...pkg?.travetto?.build?.watchIgnores ?? [],
      '**/node_modules',
      '.*/**/node_modules'
    ];
    const ignores = new Set(['node_modules', '.git']);
    for (const item of patterns) {
      if (item.includes('*')) {
        for await (const sub of fs.glob(item, { cwd: root })) {
          if (sub.startsWith('node_modules')) {
            continue;
          } else if (sub.endsWith('/node_modules')) {
            ignores.add(sub.split('/node_modules')[0]);
          } else {
            ignores.add(sub);
          }
        }
      } else {
        ignores.add(item);
      }
    }
    this.#ignoreCache[root] = [...ignores].sort().map(x => x.endsWith('/') ? x : `${x}/`);
    return this.#ignoreCache[root];
  }

  /** Get map of files from compiler events */
  static getManifestFiles(idx: ManifestIndex, events: CompilerWatchEvent[]): ModuleFileMap {
    const mods = [...new Set(events.map(v => v.entry.module.name))];

    const parents = new Map<string, string[]>(
      mods.map(m => [m, idx.getDependentModules(m, 'parents').map(x => x.name)])
    );

    const moduleToFiles: ModuleFileMap = new Map(
      [...mods, ...parents.values()].flat().map(m => [m, {
        context: ManifestUtil.getModuleContext(idx.manifest, idx.getManifestModule(m)!.sourceFolder),
        events: []
      }])
    );

    for (const ev of events) {
      const modName = ev.entry.module.name;
      for (const parent of parents.get(modName)!) {
        const mod = moduleToFiles.get(parent);
        if (!mod || !mod.events) {
          throw new CompilerReset(`Unknown module ${modName}`);
        }
        mod.events.push(ev);
      }
    }

    return moduleToFiles;
  }

  /** Rebuild manifest index */
  static async updateManifests(root: string, moduleToFiles: ModuleFileMap): Promise<void> {
    for (const { context, events } of moduleToFiles.values()) {
      const newManifest = await ManifestUtil.buildManifest(context);
      for (const { action, file, entry } of events) {
        const mod = entry.module.name;
        const modRoot = entry.module.sourceFolder || root;
        const moduleFile = file.includes(modRoot) ? file.split(`${modRoot}/`)[1] : file;
        const folderKey = ManifestModuleUtil.getFolderKey(moduleFile);
        const fileType = ManifestModuleUtil.getFileType(moduleFile);

        const modFiles = newManifest.modules[mod].files[folderKey] ??= [];
        const modIndex = modFiles.findIndex(x => x[0] === moduleFile);

        if (action === 'create' && modIndex < 0) {
          modFiles.push([moduleFile, fileType, Date.now()]);
        } else if (modIndex >= 0) {
          if (action === 'delete') {
            modFiles.splice(modIndex, 1);
          } else {
            modFiles[modIndex] = [moduleFile, fileType, Date.now()];
          }
        }
      }
      await ManifestUtil.writeManifest(newManifest);
    }
  }

  /** Listen recursively for file changes */
  static async listenFiles(root: string, q: AsyncQueue<WatchEvent[]>, signal: AbortSignal): Promise<() => void> {
    const lib = await import('@parcel/watcher');
    const ignore = await this.getWatchIgnores(root);

    const listener = await lib.subscribe(root, (err, events) => {
      if (err) {
        q.throw(err instanceof Error ? err : new Error(`${err}`));
        return;
      }
      q.add(events.map(ev => ({ action: ev.type, file: path.toPosix(ev.path) })));
    }, { ignore });

    const close = (): void => {
      listener.unsubscribe();
      signal.removeEventListener('abort', close);
    };
    signal.addEventListener('abort', close);
    return close;
  }

  /** Listen at a single level for folder changes */
  static listenFolder(folder: string, q: AsyncQueue<WatchEvent[]>, signal: AbortSignal, ignore: Set<string>): () => void {
    const listener = watch(folder, { encoding: 'utf8' }, async (ev, f) => {
      if (!f) {
        return;
      }
      const full = path.resolve(folder, f);
      const stat = await fs.stat(full).catch(() => null);
      if (!ignore.has(full)) {
        q.add([{ action: !stat ? 'delete' : 'update', file: full }]);
      }
    });

    const close = (): void => {
      listener.close();
      signal.removeEventListener('abort', close);
    };
    signal.addEventListener('abort', close);
    return close;
  }


  /**
   * Watch workspace given a compiler state
   */
  static async * watch(state: CompilerState, signal: AbortSignal): AsyncIterable<CompilerWatchEvent> {
    const build = state.manifest.build;
    const root = state.manifest.workspace.path;
    const toolRootFolder = path.dirname(path.resolve(root, build.compilerFolder));
    const toolFolders = new Set([path.dirname(build.compilerFolder), build.compilerFolder, build.typesFolder, build.outputFolder]);
    const toolingPrefixRe = new RegExp(`^(${[...toolFolders].join('|')})`.replace(/[.]/g, '[.]'));
    const watchCanary = path.resolve(toolRootFolder, 'canary');
    let lastCheckedTime = Date.now();

    log.debug('Tooling Folders', [...toolFolders]);
    log.debug('Ignore Globs', await this.getWatchIgnores(root));

    await ManifestFileUtil.bufferedFileWrite(watchCanary, '');

    const q = new AsyncQueue<Omit<CompilerWatchEvent, 'entry'>[]>();

    if (!signal.aborted) {
      await this.listenFolder(toolRootFolder, q, signal, new Set([watchCanary]));
      let stopListen = await this.listenFiles(root, q, signal);

      const value = setInterval(async () => {
        const delta = Math.trunc((Date.now() - lastCheckedTime) / 1000);
        log.debug('Checking canary', delta);
        if (delta > 10) {
          q.throw(new CompilerReset(`Watch stopped responding ${delta}s ago`));
        } else if (delta > 2) {
          stopListen();
          log.debug('Restarting parcel watcher due to inactivity');
          stopListen = await this.listenFiles(root, q, signal);
        } else {
          await fs.utimes(watchCanary, new Date(), new Date());
        }
      }, 1000);

      signal.addEventListener('abort', () => clearInterval(value));
    }

    for await (const events of q) {
      lastCheckedTime = Date.now();

      if (events.length > 25) {
        throw new CompilerReset(`Large influx of file changes: ${events.length}`);
      }

      const outEvents = events
        .map(ev => {
          let entry = state.getBySource(ev.file);
          const mod = entry?.module ?? state.manifestIndex.findModuleForArbitraryFile(ev.file);
          const relativeFile = ev.file.replace(`${root}/`, '');
          const fileType = ManifestModuleUtil.getFileType(relativeFile);
          return { entry, module: mod, ...ev, relativeFile, fileType };
        })
        .filter((ev): ev is (typeof ev) & { module: ManifestModule } => {
          if (ROOT_PACKAGE_FILES.has(ev.relativeFile)) {
            throw new CompilerReset(`Package information changed ${ev.file}`);
          } else if (ev.action === 'delete' && toolFolders.has(ev.relativeFile)) {
            throw new CompilerReset(`Tooling folder removal ${ev.file}`);
          } else if (ev.file === watchCanary) {
            return false;
          } else if (ev.relativeFile.startsWith('.') || toolingPrefixRe.test(ev.relativeFile)) {
            return false;
          } else if (!CompilerUtil.validFile(ev.fileType)) {
            return false;
          } else if (!ev.module) { // Unknown module
            log.debug(`Unknown module for a given file ${ev.relativeFile}`);
            return false;
          } else if (!ev.entry && ev.action !== 'create') {
            log.debug(`Skipping unknown file ${ev.relativeFile}`);
            return false;
          } else if (ev.entry && ev.action === 'update' && !state.checkIfSourceChanged(ev.entry.sourceFile)) {
            log.debug(`Skipping update, as contents unchanged ${ev.relativeFile}`);
            return false;
          }
          return true;
        })
        .map(({ entry, action, file, module, relativeFile }) => {
          const modRoot = module.sourceFolder || state.manifest.workspace.path;
          const moduleFile = file.includes(modRoot) ? file.split(`${modRoot}/`)[1] : file;

          entry ??= state.registerInput(module, moduleFile);

          if (action === 'delete') {
            state.removeSource(entry.sourceFile);
          }

          log.debug(`${action} ${relativeFile}`);
          return { action, file: entry.sourceFile, entry };
        });

      try {
        const filtered = outEvents.filter(x => x.entry.outputFile && x.action !== 'update');
        if (events.length) {
          const moduleToFiles = this.getManifestFiles(state.manifestIndex, filtered);
          await this.updateManifests(state.manifest.workspace.path, moduleToFiles);
          state.manifestIndex.init(ManifestUtil.getManifestLocation(state.manifest));
        }
      } catch (err) {
        log.info('Restarting due to manifest rebuild failure', err);
        if (!(err instanceof CompilerReset)) {
          err = new CompilerReset(`Manifest rebuild failure: ${err}`);
        }
        throw err;
      }

      yield* outEvents;
    }
  }
}