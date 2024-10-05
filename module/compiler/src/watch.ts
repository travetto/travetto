import fs from 'node:fs/promises';
import { unwatchFile, watch, watchFile } from 'node:fs';

import { type ManifestContext, ManifestFileUtil, ManifestIndex, ManifestModuleUtil, ManifestUtil, PackageUtil, path } from '@travetto/manifest';

import { CompilerReset, type CompilerWatchEvent } from './types';
import { CompilerState } from './state';
import { CompilerUtil } from './util';

import { AsyncQueue } from '../support/queue';
import { IpcLogger } from '../support/log';

const log = new IpcLogger({ level: 'debug' });

type WatchEvent = Omit<CompilerWatchEvent, 'entry'>;
type ModuleFileMap = Map<string, { context: ManifestContext, events: CompilerWatchEvent[] }>;

const DEFAULT_WRITE_LIMIT_MS = 300 * 1000; // 5 minute
const EDITOR_WRITE_LIMIT_SEC = 30;
const ROOT_PACKAGE_FILES = new Set(['package-lock.json', 'yarn.lock', 'package.json']);

const toMin = (v: number): number => Math.trunc((Date.now() - v) / (1000 * 60));
const toSec = (v: number): number => Math.trunc((Date.now() - v) / (1000));

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

  /** Create watchdog that will fire every multiple of threshold if reset is not called */
  static createWatchDog(signal: AbortSignal, threshold: number, onStall: (lastWriteTs: number) => void): () => number {
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

    return (): number => {
      writeThreshold = threshold;
      return lastWrite = Date.now();
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

  /** Listen for a single file change */
  static async listenFile(file: string, q: AsyncQueue<WatchEvent[]>, signal: AbortSignal): Promise<void> {
    if (!await fs.stat(file).catch(() => null)) {
      await ManifestFileUtil.bufferedFileWrite(file, '');
    }
    const handler = (): void => q.add([{ file, action: 'update' }]);
    watchFile(file, handler);
    signal.addEventListener('abort', () => unwatchFile(file, handler));
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
    const editorTouchFile = path.resolve(root, build.toolFolder, 'editor-write');

    log.debug('Tooling Folders', [...toolFolders]);
    log.debug('Ignore Globs', await this.getWatchIgnores(root));

    const q = new AsyncQueue<Omit<CompilerWatchEvent, 'entry'>[]>();

    await this.listenFile(editorTouchFile, q, signal);
    await this.listenFiles(root, q, signal);
    await this.listenFolder(toolRootFolder, q, signal);

    let lastCheckedTime = Date.now();

    const watchDogReset = this.createWatchDog(signal, DEFAULT_WRITE_LIMIT_MS, async timestamp => {
      const maxTimestamp = await this.checkWatchStaleness(state.manifest, timestamp);
      if (maxTimestamp) {
        q.throw(new CompilerReset(`File watch timed out as of ${toMin(timestamp)}m ago`));
      } else {
        lastCheckedTime = Date.now();
        log.debug(`Watch has not seen changes in ${toMin(timestamp)}m`);
      }
    });

    for await (const events of q) {
      if (events.length > 25) {
        throw new CompilerReset(`Large influx of file changes: ${events.length}`);
      }

      lastCheckedTime = watchDogReset();

      const outEvents: CompilerWatchEvent[] = [];

      for (const ev of events) {
        const { action, file: sourceFile } = ev;

        const relativeFile = sourceFile.replace(`${root}/`, '');
        const fileType = ManifestModuleUtil.getFileType(relativeFile);
        let entry = state.getBySource(sourceFile);
        const mod = entry?.module ?? state.manifestIndex.findModuleForArbitraryFile(sourceFile);

        if (ROOT_PACKAGE_FILES.has(relativeFile)) {
          throw new CompilerReset(`Package information changed ${ev.file}`);
        } else if (action === 'delete' && toolFolders.has(relativeFile)) {
          throw new CompilerReset(`Tooling folder removal ${ev.file}`);
        } else if (relativeFile.startsWith('.') || toolingPrefixRe.test(relativeFile)) {
          if (sourceFile === editorTouchFile && toSec(lastCheckedTime) > EDITOR_WRITE_LIMIT_SEC) {
            const maxStale = await this.checkWatchStaleness(state.manifest, lastCheckedTime);
            if (maxStale) {
              log.debug(`Editor file touched, stale since ${toSec(lastCheckedTime)}s`);
              throw new CompilerReset(`File watch timed out as of ${toSec(lastCheckedTime)}s ago`);
            } else {
              log.debug('Editor file touched, no changes detected');
            }
          }
          continue;
        } else if (!CompilerUtil.validFile(fileType)) {
          continue;
        } else if (!mod) { // Unknown module
          log.debug(`Unknown module for a given file ${relativeFile}`);
          continue;
        }

        const modRoot = mod.sourceFolder || state.manifest.workspace.path;
        const moduleFile = sourceFile.includes(modRoot) ? sourceFile.split(`${modRoot}/`)[1] : sourceFile;

        if (action === 'create') {
          entry = state.registerInput(mod, moduleFile);
          log.debug(`Creating ${relativeFile}`);
          outEvents.push({ action, file: entry.sourceFile, entry });
        } else if (!entry) {
          log.debug(`Skipping unknown file ${relativeFile}`);
        } else if (action === 'update') {
          if (state.checkIfSourceChanged(entry.sourceFile)) {
            outEvents.push({ action, file: entry.sourceFile, entry });
            log.debug(`Updating ${relativeFile}`);
          } else {
            log.debug(`Skipping update, as contents unchanged ${relativeFile}`);
          }
        } else if (action === 'delete') {
          state.removeSource(entry.sourceFile);
          log.debug(`Removing ${relativeFile}`);
          outEvents.push({ action, file: entry.sourceFile, entry });
        }
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
          err = new CompilerReset(`Manifest rebuild failure: ${err}`);
        }
        throw err;
      }
      yield* outEvents;
    }
  }
}