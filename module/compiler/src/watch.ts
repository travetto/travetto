import { readFileSync } from 'fs';
import fs from 'fs/promises';

import {
  ManifestContext, ManifestModuleUtil, ManifestUtil, WatchEvent, ManifestModuleFolderType,
  ManifestModuleFileType, path, ManifestModule, watchFolders, WatchEventListener
} from '@travetto/manifest';
import { getManifestContext } from '@travetto/manifest/bin/context';

import { CompilerState } from './state';
import { CompilerUtil } from './util';
import { CompileEmitter, CompileWatcherHandler } from './types';

/**
 * Utils for watching
 */
export class CompilerWatcher {

  #sourceHashes = new Map<string, number>();
  #manifestContexts = new Map<string, ManifestContext>();
  #dirtyFiles: { modFolder: string, mod: string, moduleFile?: string, folderKey?: ManifestModuleFolderType, type?: ManifestModuleFileType }[] = [];
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

    const files = this.#dirtyFiles;
    this.#dirtyFiles = [];

    for (const ctx of [...contexts, this.#state.manifest]) {
      const newManifest = await ManifestUtil.buildManifest(ctx);
      for (const file of files) {
        if (
          file.folderKey && file.moduleFile && file.type &&
          file.mod in newManifest.modules && file.folderKey in newManifest.modules[file.mod].files
        ) {
          newManifest.modules[file.mod].files[file.folderKey]!.push([file.moduleFile, file.type, Date.now()]);
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

  /**
   * Get a watcher for a given compiler state
   * @param state
   * @param handler
   * @returns
   */
  #getWatcher(handler: CompileWatcherHandler): WatchEventListener {
    const mods = this.#getModuleMap();

    return async ({ file: sourceFile, action }: WatchEvent, folder: string): Promise<void> => {
      const mod = mods[folder];
      const moduleFile = sourceFile.includes(mod.sourceFolder) ? sourceFile.split(`${mod.sourceFolder}/`)[1] : sourceFile;
      switch (action) {
        case 'create': {
          const fileType = ManifestModuleUtil.getFileType(moduleFile);
          this.#dirtyFiles.push({
            mod: mod.name,
            modFolder: folder,
            moduleFile,
            folderKey: ManifestModuleUtil.getFolderKey(sourceFile),
            type: ManifestModuleUtil.getFileType(sourceFile)
          });
          if (CompilerUtil.validFile(fileType)) {
            await this.#rebuildManifestsIfNeeded();

            const hash = CompilerUtil.naiveHash(readFileSync(sourceFile, 'utf8'));
            const input = this.#state.registerInput(mod, moduleFile);
            this.#sourceHashes.set(sourceFile, hash);
            handler.create(input);
          }
          break;
        }
        case 'update': {
          await this.#rebuildManifestsIfNeeded();
          const entry = this.#state.getBySource(sourceFile);
          if (entry) {
            const hash = CompilerUtil.naiveHash(readFileSync(sourceFile, 'utf8'));
            if (this.#sourceHashes.get(sourceFile) !== hash) {
              this.#state.resetInputSource(entry.input);
              this.#sourceHashes.set(sourceFile, hash);
              handler.update(entry.input);
            }
          }
          break;
        }
        case 'delete': {
          const entry = this.#state.getBySource(sourceFile);
          if (entry) {
            this.#state.removeInput(entry.input);
            if (entry.output) {
              this.#dirtyFiles.push({ mod: mod.name, modFolder: folder });
              handler.delete(entry.output);
            }
          }
        }
      }
    };
  }

  /**
   * Watch files based on root index
   */
  watchFiles(emit: CompileEmitter): Promise<() => Promise<void>> {
    return watchFolders(
      this.#state.manifestIndex.getLocalInputFolders(),
      this.#getWatcher({
        create: emit,
        update: emit,
        delete: (outputFile) => fs.unlink(outputFile).catch(() => { })
      }),
      {
        filter: ev => ev.file.endsWith('.ts') || ev.file.endsWith('.js') || ev.file.endsWith('package.json'),
        ignore: ['node_modules']
      }
    );
  }
}