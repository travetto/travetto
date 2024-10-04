import fs from 'node:fs/promises';
import { watch } from 'node:fs';

import {
  type ManifestContext, type ManifestModuleFileType, type ManifestModuleFolderType,
  ManifestIndex, ManifestModuleUtil, ManifestUtil, PackageUtil, path
} from '@travetto/manifest';

import { CompilerReset, type CompilerWatchEvent } from './types';
import { CompilerState } from './state';
import { CompilerUtil } from './util';

import { AsyncQueue } from '../support/queue';
import { IpcLogger } from '../support/log';

const log = new IpcLogger({ level: 'debug' });

type WatchEvent = Omit<CompilerWatchEvent, 'entry'>;
type ModuleFileMap = Map<string, { context: ManifestContext, events: CompilerWatchEvent[] }>;

const DEFAULT_WRITE_LIMIT = 1000 * 60 * 5;
const ROOT_PACKAGE_FILES = new Set(['package-lock.json', 'yarn.lock', 'package.json']);

export class CompilerWatcher {

  static #ignoreCache: Record<string, string[]> = {};

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

  /** Create watchdog that will fire every multiple of threshold if reset is not called */
  static createWatchDog(signal: AbortSignal, threshold: number, onStall: (lastWriteTs: number) => void): () => void {
    let lastWrite = Date.now();
    let writeThreshold = threshold;
    const value = setInterval(() => {
      if (Date.now() > (lastWrite + writeThreshold)) {
        onStall(lastWrite);
        writeThreshold += threshold;
      }
    }, threshold / 10);

    signal.addEventListener('abort', () => clearInterval(value));

    if (signal.aborted) {
      clearInterval(value);
    }

    return (): void => {
      lastWrite = Date.now();
      writeThreshold = threshold;
    };
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
  static async listenFiles(root: string, q: AsyncQueue<WatchEvent[]>, signal: AbortSignal): Promise<void> {
    const lib = await import('@parcel/watcher');
    const ignore = await this.getWatchIgnores(root);

    const listener = await lib.subscribe(root, (err, events) => {
      if (err) {
        q.throw(err instanceof Error ? err : new Error(`${err}`));
        return;
      }
      q.add(events.map(ev => ({ action: ev.type, file: path.toPosix(ev.path) })));
    }, { ignore });
    signal.addEventListener('abort', () => listener.unsubscribe());
  }

  /** Listen at a single level for folder changes */
  static listenFolder(folder: string, q: AsyncQueue<WatchEvent[]>, signal: AbortSignal): void {
    const listener = watch(folder, { encoding: 'utf8' }, async (ev, f) => {
      if (!f) {
        return;
      }
      const full = path.resolve(folder, f);
      const missing = !(await fs.stat(full).catch(() => null));
      q.add([{ action: missing ? 'delete' : 'update', file: full }]);
    });
    signal.addEventListener('abort', () => listener.close());
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

    log.debug('Tooling Folders', [...toolFolders]);
    log.debug('Ignore Globs', await this.getWatchIgnores(root));

    const q = new AsyncQueue<Omit<CompilerWatchEvent, 'entry'>[]>();

    await this.listenFiles(root, q, signal);
    await this.listenFolder(toolRootFolder, q, signal);

    const watchDogReset = this.createWatchDog(signal, DEFAULT_WRITE_LIMIT, async (lastWrite) => {
      const toMin = (v: number): number => Math.trunc((Date.now() - v) / (1000 * 60));
      let maxTimestamp = 0;
      const manifest = await ManifestModuleUtil.produceModules(state.manifest);
      for (const mod of Object.values(manifest)) {
        for (const file of Object.values(mod.files)) {
          for (const [, , timestamp,] of file) {
            maxTimestamp = Math.max(timestamp, maxTimestamp);
            if (maxTimestamp > lastWrite) {
              q.throw(new CompilerReset(`File watch timed out, last write time ${new Date(lastWrite).toISOString()}`));
              return;
            }
          }
        }
      }
      log.info(`Watch has not seen changes in ${toMin(lastWrite)}m, last file changed: ${toMin(maxTimestamp)}`);
    });

    for await (const events of q) {
      if (events.length > 25) {
        throw new CompilerReset(`Large influx of file changes: ${events.length}`);
      }

      const outEvents: CompilerWatchEvent[] = [];

      for (const ev of events) {
        const { action, file: sourceFile } = ev;

        const relativeFile = sourceFile.replace(`${root}/`, '');

        if (ROOT_PACKAGE_FILES.has(relativeFile)) {
          throw new CompilerReset(`Package information changed ${ev.file}`);
        } else if (action === 'delete' && toolFolders.has(relativeFile)) {
          throw new CompilerReset(`Tooling folder removal ${ev.file}`);
        } else if (relativeFile.startsWith('.') || toolingPrefixRe.test(relativeFile)) {
          continue;
        }

        watchDogReset();

        const fileType = ManifestModuleUtil.getFileType(sourceFile);
        if (!CompilerUtil.validFile(fileType)) {
          continue;
        }

        let entry = state.getBySource(sourceFile);

        const mod = entry?.module ?? state.manifestIndex.findModuleForArbitraryFile(sourceFile);
        if (!mod) { // Unknown module
          log.debug(`Unknown module for a given file ${relativeFile}`);
          continue;
        }

        const modRoot = mod.sourceFolder || state.manifest.workspace.path;
        const moduleFile = sourceFile.includes(modRoot) ? sourceFile.split(`${modRoot}/`)[1] : sourceFile;

        if (action === 'create') {
          entry = state.registerInput(mod, moduleFile);
        } else if (!entry) {
          log.debug(`Unknown file ${relativeFile}`);
          continue;
        } else if (action === 'update' && !state.checkIfSourceChanged(entry.sourceFile)) {
          log.debug(`Skipping update, as contents unchanged ${relativeFile}`);
          continue;
        } else if (action === 'delete') {
          state.removeSource(entry.sourceFile);
        }

        log.debug(`Compiling ${action}: ${relativeFile}`);

        outEvents.push({ action, file: entry.sourceFile, entry });
      }

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
          err = new CompilerReset(`Manifest rebuild failure: ${events[0].file} -- ${err}`);
        }
        throw err;
      }
      yield* outEvents;
    }
  }
}