import os from 'node:os';

import { ManifestContext, type ManifestModuleFileType, type ManifestModuleFolderType, ManifestModuleUtil, ManifestUtil, PackageUtil, path } from '@travetto/manifest';

import type { CompileStateEntry } from './types';
import { CompilerState } from './state';
import { CompilerUtil } from './util';

import { AsyncQueue } from '../support/queue';
import { IpcLogger } from '../support/log';

const log = new IpcLogger({ level: 'debug' });

type WatchAction = 'create' | 'update' | 'delete';
type WatchEvent = { action: WatchAction, file: string };
type CompilerWatchEvent = WatchEvent & { entry: CompileStateEntry };
type FileShape = {
  mod: string;
  folderKey: ManifestModuleFolderType;
  fileType: ManifestModuleFileType;
  moduleFile: string;
  action: WatchAction;
};

const DEFAULT_WRITE_LIMIT = 1000 * 60 * 5;

/**
 * Watch support, based on compiler state and manifest details
 */
export class CompilerWatcher {
  #state: CompilerState;
  #signal: AbortSignal;

  constructor(state: CompilerState, signal: AbortSignal) {
    this.#state = state;
    this.#signal = signal;
  }

  #watchDog(): { reset(): void, close(): void } {
    let lastWrite = Date.now();
    let writeThreshold = DEFAULT_WRITE_LIMIT;
    log.info('Starting watchdog');
    const value = setInterval(() => {
      if (Date.now() > (lastWrite + writeThreshold)) {
        const delta = (Date.now() - lastWrite) / (1000 * 60);
        log.info(`Watch has not seen changes in ${Math.trunc(delta)}m`);
        writeThreshold += DEFAULT_WRITE_LIMIT;
      }
    }, DEFAULT_WRITE_LIMIT / 10);
    return {
      close: (): void => {
        log.info('Closing watchdog');
        clearInterval(value);
      },
      reset: (): void => {
        lastWrite = Date.now();
        writeThreshold = DEFAULT_WRITE_LIMIT;
      }
    };
  }

  #reset(ev: WatchEvent): never {
    throw new Error('RESET', { cause: `${ev.action}:${ev.file}` });
  }

  #getIgnores(): string[] {
    // TODO: Read .gitignore?
    let ignores = PackageUtil.readPackage(this.#state.manifest.workspace.path)?.travetto?.build?.watchIgnores;

    if (!ignores) {
      ignores = ['node_modules/**'];
    }

    // TODO: Fix once node/parcel sort this out
    return os.platform() === 'linux' ? [] : [
      ...ignores,
      '.git', '**/.git',
      `${this.#state.manifest.build.outputFolder}/node_modules/**`,
      `${this.#state.manifest.build.compilerFolder}/node_modules/**`,
      `${this.#state.manifest.build.toolFolder}/**`
    ];
  }

  /** Watch files */
  async * #watchFolder(rootPath: string): AsyncIterable<WatchEvent[]> {
    const q = new AsyncQueue<WatchEvent[]>(this.#signal);
    const lib = await import('@parcel/watcher');
    const ignore = this.#getIgnores();

    const cleanup = await lib.subscribe(rootPath, (err, events) => {
      if (err) {
        q.throw(err instanceof Error ? err : new Error(`${err}`));
        return;
      }
      q.add(events.map(ev => ({ action: ev.type, file: path.toPosix(ev.path) })));
    }, { ignore });

    if (this.#signal.aborted) { // If already aborted, can happen async
      cleanup.unsubscribe();
      return;
    }

    this.#signal.addEventListener('abort', () => cleanup.unsubscribe());

    yield* q;
  }

  async #rebuildManifestsIfNeeded(events: CompilerWatchEvent[]): Promise<void> {
    events = events.filter(x => x.entry.outputFile && x.action !== 'update');

    if (!events.length) {
      return;
    }

    const mods = [...new Set(events.map(v => v.entry.module.name))];

    const parents = new Map<string, string[]>(
      mods.map(m => [m, this.#state.manifestIndex.getDependentModules(m, 'parents').map(x => x.name)])
    );

    const moduleToFiles = new Map<string, { context: ManifestContext, files: FileShape[] }>(
      [...mods, ...parents.values()].flat().map(m => [m, {
        context: ManifestUtil.getModuleContext(this.#state.manifest, this.#state.manifestIndex.getManifestModule(m)!.sourceFolder),
        files: []
      }])
    );

    const allFiles = events.map(ev => {
      const modRoot = ev.entry.module.sourceFolder || this.#state.manifest.workspace.path;
      const moduleFile = ev.file.includes(modRoot) ? ev.file.split(`${modRoot}/`)[1] : ev.file;
      const folderKey = ManifestModuleUtil.getFolderKey(moduleFile);
      const fileType = ManifestModuleUtil.getFileType(moduleFile);
      return { mod: ev.entry.module.name, action: ev.action, moduleFile, folderKey, fileType };
    });

    for (const file of allFiles) {
      for (const parent of parents.get(file.mod)!) {
        const mod = moduleToFiles.get(parent);
        if (!mod || !mod.files) {
          this.#reset({ action: file.action, file: `${file.mod}/${file.moduleFile}` });
        }
        mod.files.push(file);
      }
    }

    for (const { context, files } of moduleToFiles.values()) {
      const newManifest = await ManifestUtil.buildManifest(context);
      for (const { action, mod, fileType, moduleFile, folderKey } of files) {
        const modFiles = newManifest.modules[mod].files[folderKey] ??= [];
        const idx = modFiles.findIndex(x => x[0] === moduleFile);

        if (action === 'create' && idx < 0) {
          modFiles.push([moduleFile, fileType, Date.now()]);
        } else if (idx >= 0) {
          if (action === 'delete') {
            modFiles.splice(idx, 1);
          } else {
            modFiles[idx] = [moduleFile, fileType, Date.now()];
          }
        }
      }
      await ManifestUtil.writeManifest(newManifest);
    }

    // Reindex at workspace root
    this.#state.manifestIndex.init(ManifestUtil.getManifestLocation(this.#state.manifest));
  }

  /**
   * Get a watcher for a given compiler state
   * @param state
   * @param handler
   * @returns
   */
  async * watchChanges(): AsyncIterable<CompilerWatchEvent> {
    if (this.#signal.aborted) {
      return;
    }

    const manifest = this.#state.manifest;
    const ROOT_LOCK = path.resolve(manifest.workspace.path, 'package-lock.json');
    const ROOT_PKG = path.resolve(manifest.workspace.path, 'package.json');
    const OUTPUT_PATH = path.resolve(manifest.workspace.path, manifest.build.outputFolder);
    const COMPILER_PATH = path.resolve(manifest.workspace.path, manifest.build.compilerFolder);

    const watchDog = this.#watchDog();

    for await (const events of this.#watchFolder(this.#state.manifest.workspace.path)) {

      const outEvents: CompilerWatchEvent[] = [];

      for (const ev of events) {
        const { action, file: sourceFile } = ev;

        if (
          sourceFile === ROOT_LOCK ||
          sourceFile === ROOT_PKG ||
          (action === 'delete' && (sourceFile === OUTPUT_PATH || sourceFile === COMPILER_PATH))
        ) {
          this.#reset(ev);
        }

        watchDog.reset();

        const fileType = ManifestModuleUtil.getFileType(sourceFile);
        if (!CompilerUtil.validFile(fileType)) {
          continue;
        }

        let entry = this.#state.getBySource(sourceFile);

        const mod = entry?.module ?? this.#state.manifestIndex.findModuleForArbitraryFile(sourceFile);
        if (!mod) { // Unknown module
          log.debug(`Unknown module for a given file ${sourceFile}`);
          continue;
        }

        const modRoot = mod.sourceFolder || this.#state.manifest.workspace.path;
        const moduleFile = sourceFile.includes(modRoot) ? sourceFile.split(`${modRoot}/`)[1] : sourceFile;

        if (action === 'create') {
          entry = this.#state.registerInput(mod, moduleFile);
        } else if (!entry) {
          log.debug(`Unknown file ${sourceFile}`);
          continue;
        } else if (action === 'update' && !this.#state.checkIfSourceChanged(entry.sourceFile)) {
          log.debug(`Skipping update, as contents unchanged ${entry.sourceFile}`);
          continue;
        } else if (action === 'delete') {
          this.#state.removeSource(entry.sourceFile);
        }

        outEvents.push({ action, file: entry.sourceFile, entry });
      }

      await this.#rebuildManifestsIfNeeded(outEvents);
      yield* outEvents;
    }

    watchDog.close();
  }
}