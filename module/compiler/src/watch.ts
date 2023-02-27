import { readFileSync } from 'fs';
import fs from 'fs/promises';

import {
  ManifestContext, ManifestModuleUtil, ManifestUtil, WatchEvent, ManifestModuleFolderType,
  ManifestModuleFileType, path, ManifestModule, watchFolders, WatchEventListener, watchFolderImmediate, WatchConfig
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
        if (file.folderKey && file.moduleFile && file.type && file.mod in newManifest.modules) {
          newManifest.modules[file.mod].files[file.folderKey] ??= [];
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
      const moduleFile = mod.sourceFolder ?
        (sourceFile.includes(mod.sourceFolder) ? sourceFile.split(`${mod.sourceFolder}/`)[1] : sourceFile) :
        sourceFile.replace(`${this.#state.manifest.workspacePath}/`, '');
      switch (action) {
        case 'create': {
          const fileType = ManifestModuleUtil.getFileType(moduleFile);
          this.#dirtyFiles.push({
            mod: mod.name,
            modFolder: folder,
            moduleFile,
            folderKey: ManifestModuleUtil.getFolderKey(moduleFile),
            type: ManifestModuleUtil.getFileType(moduleFile)
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
  async watchFiles(emit: CompileEmitter): Promise<() => Promise<void>> {
    let watchRoot: (() => Promise<void>) | undefined = undefined;

    const idx = this.#state.manifestIndex;
    const modules = [...idx.getModuleList('all')].map(x => idx.getModule(x)!);
    const remove = (outputFile: string): Promise<void> => fs.rm(outputFile, { force: true });
    const handler = this.#getWatcher({ create: emit, update: emit, delete: remove });
    const options: WatchConfig = {
      filter: ev => ev.file.endsWith('.ts') || ev.file.endsWith('.js') || ev.file.endsWith('package.json'),
      ignore: ['node_modules']
    };

    const moduleFolders = modules
      .filter(x => !idx.manifest.monoRepo || x.sourcePath !== idx.manifest.workspacePath)
      .map(x => [x.sourcePath, x.sourcePath] as const);

    // Add monorepo folders
    if (idx.manifest.monoRepo) {
      const mono = modules.find(x => x.sourcePath === idx.manifest.workspacePath)!;
      for (const folder of Object.keys(mono.files)) {
        if (!folder.startsWith('$')) {
          moduleFolders.push([path.resolve(mono.sourcePath, folder), mono.sourcePath]);
        }
      }
      watchRoot = await watchFolderImmediate(mono.sourcePath, handler, options);
    }

    const watchAll = await watchFolders(moduleFolders, handler, options);

    return () => Promise.all([watchRoot?.(), watchAll()]).then(() => { });
  }
}