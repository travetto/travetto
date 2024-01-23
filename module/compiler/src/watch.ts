import { ManifestContext, ManifestModuleUtil, ManifestUtil, RuntimeIndex, path } from '@travetto/manifest';

import type { CompileStateEntry } from './types';
import { CompilerState } from './state';
import { CompilerUtil } from './util';

import { AsyncQueue } from '../support/queue';

type WatchAction = 'create' | 'update' | 'delete';
type WatchEvent = { action: WatchAction, file: string };
type CompilerWatchEvent = WatchEvent & { entry: CompileStateEntry };

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
        `${this.#state.manifest.build.outputFolder}/node_modules/**`,
        `${this.#state.manifest.build.compilerFolder}/node_modules/**`,
        `${this.#state.manifest.build.toolFolder}/**`
      ]
    });

    this.#signal.addEventListener('abort', () => cleanup.unsubscribe());

    yield* q;
  }

  async #rebuildManifestsIfNeeded(event: CompilerWatchEvent, moduleFile: string): Promise<void> {
    if (!event.entry.outputFile || event.action === 'update') {
      return;
    }

    const toUpdate: ManifestContext[] = RuntimeIndex.getDependentModules(event.entry.module.name, 'parents')
      .map(el => ManifestUtil.getModuleContext(this.#state.manifest, el.sourceFolder));

    toUpdate.push(this.#state.manifest);

    const mod = event.entry.module;
    const folderKey = ManifestModuleUtil.getFolderKey(moduleFile);
    const fileType = ManifestModuleUtil.getFileType(moduleFile);

    for (const ctx of toUpdate) {
      const newManifest = await ManifestUtil.buildManifest(ctx);
      if (mod.name in newManifest.modules) {
        const modFiles = newManifest.modules[mod.name].files[folderKey] ??= [];
        const idx = modFiles.findIndex(x => x[0] === moduleFile);

        if (event.action === 'create' && idx < 0) {
          modFiles.push([moduleFile, fileType, Date.now()]);
        } else if (idx >= 0) {
          if (event.action === 'delete') {
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

      const modRoot = mod.sourceFolder || this.#state.manifest.workspace.path;
      const moduleFile = sourceFile.includes(modRoot) ? sourceFile.split(`${modRoot}/`)[1] : sourceFile;

      if (action === 'create') {
        entry = this.#state.registerInput(mod, moduleFile);
      } else if (!entry) {
        continue;
      } else if (action === 'update' && !this.#state.checkIfSourceChanged(entry.inputFile)) {
        continue;
      } else if (action === 'delete') {
        this.#state.removeInput(entry.inputFile);
      }

      const result: CompilerWatchEvent = { action, file: entry.sourceFile, entry };
      await this.#rebuildManifestsIfNeeded(result, moduleFile);
      yield result;
    }
  }
}