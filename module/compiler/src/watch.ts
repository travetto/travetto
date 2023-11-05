import { readFileSync } from 'fs';
import { setMaxListeners } from 'events';

import {
  ManifestContext, ManifestModuleUtil, ManifestUtil, ManifestModuleFolderType, ManifestModuleFileType,
  path, ManifestModule,
} from '@travetto/manifest';
import { getManifestContext } from '@travetto/manifest/bin/context';

import type { CompileStateEntry } from './types';
import { CompilerState } from './state';
import { CompilerUtil } from './util';

import { WatchEvent, fileWatchEvents } from './internal/watch-core';

type DirtyFile = { modFolder: string, mod: string, remove?: boolean, moduleFile: string, folderKey: ManifestModuleFolderType, type: ManifestModuleFileType };

/**
 * Watch support, based on compiler state and manifest details
 */
export class CompilerWatcher {

  /**
   * Watch state
   * @param state
   * @returns
   */
  static watch(state: CompilerState): AsyncIterable<WatchEvent<{ entry: CompileStateEntry }>> {
    return new CompilerWatcher(state).watchChanges();
  }

  #sourceHashes = new Map<string, number>();
  #manifestContexts = new Map<string, ManifestContext>();
  #dirtyFiles: DirtyFile[] = [];
  #state: CompilerState;

  constructor(state: CompilerState) {
    this.#state = state;
  }

  async #rebuildManifestsIfNeeded(): Promise<void> {
    if (!this.#dirtyFiles.length) {
      return;
    }
    const mods = [...new Set(this.#dirtyFiles.map(x => x.modFolder))];
    const contexts = await Promise.all(mods.map(async folder => {
      if (!this.#manifestContexts.has(folder)) {
        const ctx = await getManifestContext(folder);
        this.#manifestContexts.set(folder, ctx);
      }
      return this.#manifestContexts.get(folder)!;
    }));

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
      await ManifestUtil.writeManifest(ctx, newManifest);
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
    const mods = this.#getModuleMap();
    const ctrl = new AbortController();
    setMaxListeners(1000, ctrl.signal);

    const modules = [...this.#state.manifestIndex.getModuleList('all')].map(x => this.#state.manifestIndex.getModule(x)!);

    const stream = fileWatchEvents(this.#state.manifest, modules, ctrl.signal);
    for await (const ev of stream) {

      if (ev.action === 'reset') {
        yield ev;
        ctrl.abort();
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