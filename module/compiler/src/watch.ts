import {
  ManifestModuleUtil, ManifestUtil, ManifestModuleFolderType, ManifestModuleFileType, path, ManifestModule
} from '@travetto/manifest';

import type { CompileStateEntry } from './types';
import { CompilerState } from './state';
import { CompilerUtil } from './util';

import { AsyncQueue } from '../support/queue';

type WatchAction = 'create' | 'update' | 'delete';
type WatchEvent = { action: WatchAction, file: string };
type CompilerWatchEvent = WatchEvent & { entry: CompileStateEntry };
type DirtyFile = { mod: ManifestModule, action: WatchAction, moduleFile: string, folderKey: ManifestModuleFolderType, type: ManifestModuleFileType };

/**
 * Watch support, based on compiler state and manifest details
 */
export class CompilerWatcher {

  #dirtyFiles: DirtyFile[] = [];
  #state: CompilerState;
  #signal: AbortSignal;

  constructor(state: CompilerState, signal: AbortSignal) {
    this.#state = state;
    this.#signal = signal;
  }

  /** Watch files */
  async * #watchFolder(rootPath: string): AsyncIterable<WatchEvent> {
    const q = new AsyncQueue<WatchEvent>(this.#signal);
    const lib = await import('@parcel/watcher');

    const cleanup = await lib.subscribe(rootPath, (err, events) => {
      if (err) {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        q.throw(err instanceof Error ? err : new Error((err as Error).message));
        return;
      }
      for (const ev of events) {
        q.add({ action: ev.type, file: path.toPosix(ev.path) });
      }
    }, {
      // TODO: Read .gitignore?
      ignore: [
        'node_modules', '**/node_modules', '.git', '**/.git',
        `${this.#state.manifest.build.outputFolder}/**`,
        `${this.#state.manifest.build.compilerFolder}/**`,
        `${this.#state.manifest.build.toolFolder}/**`
      ]
    });

    this.#signal.addEventListener('abort', () => cleanup.unsubscribe());

    yield* q;
  }

  async #rebuildManifestsIfNeeded(): Promise<void> {
    if (!this.#dirtyFiles.length) {
      return;
    }
    const mods = [...new Set(this.#dirtyFiles.map(x => x.mod.sourceFolder))];
    const contexts = mods.map(folder => ManifestUtil.getModuleContext(this.#state.manifest, folder));

    const files = this.#dirtyFiles.slice(0);
    this.#dirtyFiles = [];

    for (const ctx of [...contexts, this.#state.manifest]) {
      const newManifest = await ManifestUtil.buildManifest(ctx);
      for (const file of files) {
        if (file.mod.name in newManifest.modules) {
          const modFiles = newManifest.modules[file.mod.name].files[file.folderKey] ??= [];
          const idx = modFiles.findIndex(x => x[0] === file.moduleFile);

          if (file.action === 'create' && idx < 0) {
            modFiles.push([file.moduleFile, file.type, Date.now()]);
          } else if (idx >= 0) {
            if (file.action === 'delete') {
              modFiles.splice(idx, 1);
            } else {
              modFiles[idx] = [file.moduleFile, file.type, Date.now()];
            }
          }
        }
      }
      await ManifestUtil.writeManifest(newManifest);
    }

    // Reindex at workspace root
    this.#state.manifestIndex.init(ManifestUtil.getManifestLocation(this.#state.manifest));
  }

  #addDirtyFile(mod: ManifestModule, moduleFile: string, action: WatchAction): void {
    if (action !== 'update') {
      this.#dirtyFiles.push({
        mod, action, moduleFile,
        folderKey: ManifestModuleUtil.getFolderKey(moduleFile),
        type: ManifestModuleUtil.getFileType(moduleFile),
      });
    }
  }

  /**
   * Get a watcher for a given compiler state
   * @param state
   * @param handler
   * @returns
   */
  async * watchChanges(): AsyncIterable<CompilerWatchEvent> {
    if (this.#signal.aborted) {
      yield* [];
      return;
    }

    const manifest = this.#state.manifest;
    const ROOT_LOCK = path.resolve(manifest.workspace.path, 'package-lock.json');
    const ROOT_PKG = path.resolve(manifest.workspace.path, 'package.json');
    const OUTPUT_PATH = path.resolve(manifest.workspace.path, manifest.build.outputFolder);
    const COMPILER_PATH = path.resolve(manifest.workspace.path, manifest.build.compilerFolder);

    for await (const ev of this.#watchFolder(this.#state.manifest.workspace.path)) {
      const { action, file: sourceFile } = ev;

      if (
        sourceFile === ROOT_LOCK ||
        sourceFile === ROOT_PKG ||
        (action === 'delete' && (sourceFile === OUTPUT_PATH || sourceFile === COMPILER_PATH))
      ) {
        throw new Error('RESET');
      }

      const fileType = ManifestModuleUtil.getFileType(sourceFile);
      if (!CompilerUtil.validFile(fileType)) {
        continue;
      }

      let entry = this.#state.getBySource(sourceFile);

      const mod = entry?.module ?? this.#state.manifestIndex.findModuleForArbitraryFile(sourceFile);
      if (!mod) {
        continue;
      }

      const moduleFile = mod.sourceFolder ?
        (sourceFile.includes(mod.sourceFolder) ? sourceFile.split(`${mod.sourceFolder}/`)[1] : sourceFile) :
        sourceFile.replace(`${this.#state.manifest.workspace.path}/`, '');

      if (action === 'create') {
        entry = this.#state.registerInput(mod, moduleFile);
      } else if (!entry) {
        continue;
      } else if (action === 'update') {
        if (!this.#state.checkIfSourceChanged(entry.inputFile)) {
          continue;
        }
      } else if (action === 'delete') {
        this.#state.removeInput(entry.inputFile);
      }

      if (entry.outputFile) {
        this.#addDirtyFile(mod, moduleFile, action);
      }
      await this.#rebuildManifestsIfNeeded();
      yield { action, file: entry.sourceFile, entry };
    }
  }
}