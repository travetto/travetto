import { readFileSync } from 'node:fs';

import {
  ManifestModuleUtil, ManifestUtil, ManifestModuleFolderType, ManifestModuleFileType, path, ManifestModule
} from '@travetto/manifest';

import type { CompileStateEntry } from './types';
import { CompilerState } from './state';
import { CompilerUtil } from './util';

import { WatchEvent, fileWatchEvents } from './internal/watch-core';

type CompilerWatchEvent = WatchEvent & { entry: CompileStateEntry, folder: string };

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

  #addDirtyFile(mod: ManifestModule, moduleFile: string, remove = false): void {
    this.#dirtyFiles.push({
      mod: mod.name, modFolder: mod.sourceFolder, remove, moduleFile,
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

    for await (const ev of fileWatchEvents(this.#state.manifest.workspace.path, this.#signal)) {
      const { action, file: sourceFile } = ev;

      if (
        sourceFile === ROOT_LOCK ||
        sourceFile === ROOT_PKG ||
        (action === 'delete' && (sourceFile === OUTPUT_PATH || sourceFile === COMPILER_PATH))
      ) {
        throw new Error('RESET');
      }

      const fileType = ManifestModuleUtil.getFileType(sourceFile);
      if (!(fileType === 'ts' || fileType === 'typings' || fileType === 'js')) {
        continue;
      }

      let entry = this.#state.getBySource(sourceFile);

      const mod = entry?.module ?? this.#state.findModuleForSourceFile(sourceFile);
      if (!mod) {
        continue;
      }

      const moduleFile = mod.sourceFolder ?
        (sourceFile.includes(mod.sourceFolder) ? sourceFile.split(`${mod.sourceFolder}/`)[1] : sourceFile) :
        sourceFile.replace(`${this.#state.manifest.workspace.path}/`, '');

      switch (action) {
        case 'create': {
          this.#addDirtyFile(mod, moduleFile);
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
              this.#state.resetInputSource(entry.inputFile);
              this.#sourceHashes.set(sourceFile, hash);
            } else {
              entry = undefined;
            }
          }
          break;
        }
        case 'delete': {
          if (entry) {
            this.#state.removeInput(entry.inputFile);
            if (entry.outputFile) {
              this.#addDirtyFile(mod, moduleFile, true);
            }
          }
        }
      }

      if (entry) {
        await this.#rebuildManifestsIfNeeded();
        yield { action, file: entry.sourceFile, folder: entry.module.sourceFolder, entry };
      }
    }
  }
}