import { readFileSync } from 'fs';

import {
  ManifestContext, ManifestModuleUtil, ManifestUtil, WatchEvent, ManifestModuleFolderType,
  ManifestModuleFileType, path, ManifestModule, watchFolders, WatchFolder, RootIndex, WatchStream
} from '@travetto/manifest';
import { getManifestContext } from '@travetto/manifest/bin/context';

import { CompilerState } from './state';
import { CompilerUtil } from './util';

type CompileWatchEvent = WatchEvent | { action: 'restart', file: string };
const RESTART_SIGNAL = 'RESTART_SIGNAL';

/**
 * Utils for watching
 */
export class CompilerWatcher {

  /**
   * Watch state
   * @param state
   * @returns
   */
  static watch(state: CompilerState): AsyncIterable<CompileWatchEvent> {
    return new CompilerWatcher(state).watchChanges();
  }

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
  async * watchChanges(): AsyncIterable<CompileWatchEvent> {
    const stream = this.#watchFiles();

    const mods = this.#getModuleMap();
    for await (const { file: sourceFile, action, folder } of stream) {

      if (folder === RESTART_SIGNAL) {
        yield { action: 'restart', file: sourceFile };
        return;
      }

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
            yield { action, file: input, folder };
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
              yield { action, file: entry.input, folder };
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
              yield { action, file: entry.output, folder };
            }
          }
        }
      }
    }
  }

  /**
   * Watch files based on root index
   */
  #watchFiles(): WatchStream {
    const idx = this.#state.manifestIndex;
    const modules = [...idx.getModuleList('all')].map(x => idx.getModule(x)!);
    const options: Partial<WatchFolder> = {
      filter: (ev: WatchEvent): boolean => {
        const type = ManifestModuleUtil.getFileType(ev.file);
        return type === 'ts' || type === 'typings' || type === 'js' || type === 'package-json';
      },
      ignore: ['node_modules', '**/.trv_*'],
    };

    const moduleFolders: WatchFolder[] = modules
      .filter(x => !idx.manifest.monoRepo || x.sourcePath !== idx.manifest.workspacePath)
      .map(x => ({ src: x.sourcePath, target: x.sourcePath }));

    // Add monorepo folders
    if (idx.manifest.monoRepo) {
      const mono = modules.find(x => x.sourcePath === idx.manifest.workspacePath)!;
      for (const folder of Object.keys(mono.files)) {
        if (!folder.startsWith('$')) {
          moduleFolders.push({ src: path.resolve(mono.sourcePath, folder), target: mono.sourcePath });
        }
      }
      moduleFolders.push({ src: mono.sourcePath, target: mono.sourcePath, immediate: true });
    }

    // Watch output folders
    const outputWatch = (root: string, sources: string[]): WatchFolder => {
      const valid = new Set(sources.map(src => path.resolve(root, src)));
      return {
        src: root, target: RESTART_SIGNAL, immediate: true, includeHidden: true,
        filter: ev => ev.action === 'delete' && valid.has(path.resolve(root, ev.file))
      };
    };

    const topLevelFiles = (root: string, files: string[]): WatchFolder => {
      const valid = new Set(files.map(src => path.resolve(root, src)));
      return {
        src: root, target: RESTART_SIGNAL, immediate: true,
        filter: ev => valid.has(path.resolve(root, ev.file))
      };
    };

    moduleFolders.push(
      outputWatch(RootIndex.manifest.workspacePath, [
        RootIndex.manifest.outputFolder,
        RootIndex.manifest.compilerFolder
      ]),
      topLevelFiles(RootIndex.manifest.workspacePath, [
        'package.json',
        'package-lock.json'
      ])
    );

    return watchFolders(moduleFolders, options);
  }
}