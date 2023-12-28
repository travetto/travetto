import { readFileSync } from 'node:fs';

import {
  ManifestModuleUtil, ManifestUtil, ManifestModuleFolderType, ManifestModuleFileType, path, ManifestModule,
} from '@travetto/manifest';

import type { CompileStateEntry } from './types';
import { CompilerState } from './state';
import { CompilerUtil } from './util';

import { WatchEvent, fileWatchEvents } from './internal/watch-core';

type DirtyFile = { modFolder: string, mod: string, remove?: boolean, moduleFile: string, folderKey: ManifestModuleFolderType, type: ManifestModuleFileType };

/**
 * Watch support, based on compiler state and manifest details
 */
export class CompilerWatcher {

  #sourceHashes = new Map<string, number>();
  #dirtyFiles: DirtyFile[] = [];
  #state: CompilerState;
  #signal: AbortSignal;

  constructor(state: CompilerState, signal: AbortSignal) {
    this.#state = state;
    this.#signal = signal;
  }

  async #rebuildManifestsIfNeeded(): Promise<void> {
    if (!this.#dirtyFiles.length) {
      return;
    }
    const mods = [...new Set(this.#dirtyFiles.map(x => x.modFolder))];
    const contexts = await Promise.all(mods.map(folder =>
      ManifestUtil.getModuleContext(this.#state.manifest, folder)
    ));

    const files = this.#dirtyFiles.slice(0);
    this.#dirtyFiles = [];

    for (const ctx of [...contexts, this.#state.manifest]) {
      const newManifest = await ManifestUtil.buildManifest(ctx);
      for (const file of files) {
        if (file.mod in newManifest.modules) {
          const modFiles = newManifest.modules[file.mod].files[file.folderKey] ??= [];
          const idx = modFiles.findIndex(x => x[0] === file.moduleFile);

          if (!file.remove && idx < 0) {
            modFiles.push([file.moduleFile, file.type, Date.now()]);
          } else if (idx >= 0) {
            if (file.remove) {
              modFiles.splice(idx, 1);
            } else {
              modFiles[idx] = [file.moduleFile, file.type, Date.now()];
            }
          }
        }
      }
      await ManifestUtil.writeManifest(newManifest);
    }
    // Reindex
    this.#state.manifestIndex.init(this.#state.manifestIndex.manifestFile);
  }

  #getModuleMap(): Record<string, ManifestModule> {
    return Object.fromEntries(
      Object.values(this.#state.manifest.modules).map(x => [path.resolve(this.#state.manifest.workspacePath, x.sourceFolder), x])
    );
  }

  #addDirtyFile(mod: ManifestModule, folder: string, moduleFile: string, remove = false): void {
    this.#dirtyFiles.push({
      mod: mod.name, modFolder: folder, remove, moduleFile,
      folderKey: ManifestModuleUtil.getFolderKey(moduleFile),
      type: ManifestModuleUtil.getFileType(moduleFile),
    });
  }

  /**
   * Get a watcher for a given compiler state
   * @param state
   * @param handler
   * @returns
   */
  async * watchChanges(): AsyncIterable<WatchEvent<{ entry: CompileStateEntry }>> {
    if (this.#signal.aborted) {
      yield* [];
      return;
    }

    const mods = this.#getModuleMap();

    const modules = [...this.#state.manifestIndex.getModuleList('all')].map(x => this.#state.manifestIndex.getModule(x)!);

    const stream = fileWatchEvents(this.#state.manifest, modules, this.#signal);
    for await (const ev of stream) {

      if (ev.action === 'reset') {
        yield ev;
        return;
      }

      const { action, file: sourceFile, folder } = ev;
      const mod = mods[folder];
      const moduleFile = mod.sourceFolder ?
        (sourceFile.includes(mod.sourceFolder) ? sourceFile.split(`${mod.sourceFolder}/`)[1] : sourceFile) :
        sourceFile.replace(`${this.#state.manifest.workspacePath}/`, '');

      let entry = this.#state.getBySource(sourceFile);

      switch (action) {
        case 'create': {
          const fileType = ManifestModuleUtil.getFileType(moduleFile);
          this.#addDirtyFile(mod, folder, moduleFile);
          if (CompilerUtil.validFile(fileType)) {
            const hash = CompilerUtil.naiveHash(readFileSync(sourceFile, 'utf8'));
            entry = this.#state.registerInput(mod, moduleFile);
            this.#sourceHashes.set(sourceFile, hash);
          }
          break;
        }
        case 'update': {
          if (entry) {
            const hash = CompilerUtil.naiveHash(readFileSync(sourceFile, 'utf8'));
            if (this.#sourceHashes.get(sourceFile) !== hash) {
              this.#state.resetInputSource(entry.input);
              this.#sourceHashes.set(sourceFile, hash);
            } else {
              entry = undefined;
            }
          }
          break;
        }
        case 'delete': {
          if (entry) {
            this.#state.removeInput(entry.input);
            if (entry.output) {
              this.#addDirtyFile(mod, folder, moduleFile, true);
            }
          }
        }
      }

      if (entry) {
        await this.#rebuildManifestsIfNeeded();
        yield { action, file: entry.source, folder, entry };
      }
    }
  }
}