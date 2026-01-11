import path from './path.ts';
import { ManifestModuleUtil } from './module.ts';
import { ManifestFileUtil } from './file.ts';
import { PackageUtil } from './package.ts';

import type { ManifestContext } from './types/context.ts';
import type { ManifestRoot } from './types/manifest.ts';
import type { ChangeEventType } from './types/common.ts';

const MANIFEST_FILE = 'manifest.json';

/**
 * Manifest utils
 */
export class ManifestUtil {
  /**
   * Produce manifest in memory
   */
  static async buildManifest(ctx: ManifestContext): Promise<ManifestRoot> {
    return {
      generated: Date.now(),
      workspace: ctx.workspace,
      build: ctx.build,
      main: ctx.main,
      modules: await ManifestModuleUtil.produceModules(ctx),
    };
  }

  /**
   * Produce a manifest location given a current context and a module name
   */
  static getManifestLocation(ctx: ManifestContext, module?: string): string {
    return path.resolve(ctx.workspace.path, ctx.build.outputFolder, 'node_modules', module ?? ctx.workspace.name);
  }

  /**
   * Produce a production manifest from a given manifest
   */
  static createProductionManifest(manifest: ManifestRoot): ManifestRoot {
    const prodModules = Object.values(manifest.modules).filter(module => module.prod);
    const prodModNames = new Set([...prodModules.map(module => module.name)]);
    return {
      generated: manifest.generated,
      workspace: manifest.workspace,
      build: {
        ...manifest.build,
        // Mark output folder/workspace path as portable
        outputFolder: '$$PRODUCTION$$',
      },
      main: manifest.main,
      modules: Object.fromEntries(
        prodModules.map(module => [module.name, Object.assign(module, {
          parents: module.parents.filter(parent => prodModNames.has(parent))
        })])
      ),
    };
  }

  /**
   * Read manifest, synchronously
   *
   * @param file
   * @returns
   */
  static readManifestSync(file: string): ManifestRoot {
    file = path.resolve(file);
    if (!file.endsWith('.json')) {
      file = path.resolve(file, MANIFEST_FILE);
    }
    const manifest: ManifestRoot = ManifestFileUtil.readAsJsonSync(file);
    // Support packaged environments, by allowing empty manifest.build.outputFolder
    if (manifest.build.outputFolder === '$$PRODUCTION$$') {
      manifest.build.outputFolder = path.resolve();
      manifest.workspace.path = path.resolve();
    }
    return manifest;
  }

  /**
   * Write manifest for a given context, return location
   */
  static writeManifest(manifest: ManifestRoot): Promise<string> {
    return this.writeManifestToFile(
      path.resolve(manifest.workspace.path, manifest.build.outputFolder, 'node_modules', manifest.main.name),
      manifest
    );
  }

  /**
   * Write mono repo manifests, return names written
   */
  static async writeDependentManifests(manifest: ManifestRoot): Promise<void> {
    if (manifest.workspace.mono) {
      const modules = Object.values(manifest.modules).filter(module => module.workspace && module.name !== manifest.workspace.name);
      for (const module of modules) {
        const moduleCtx = this.getModuleContext(manifest, module.sourceFolder, true);
        const moduleManifest = await this.buildManifest(moduleCtx);
        await this.writeManifest(moduleManifest);
      }
    }
  }

  /**
   * Write a manifest to a specific file, if no file extension provided, the file is assumed to be a folder
   */
  static async writeManifestToFile(location: string, manifest: ManifestRoot): Promise<string> {
    if (!location.endsWith('.json')) {
      location = path.resolve(location, MANIFEST_FILE);
    }

    await ManifestFileUtil.bufferedFileWrite(location, JSON.stringify(manifest));

    return location;
  }

  /**
   * Produce the manifest context for the workspace module
   */
  static getWorkspaceContext(ctx: ManifestContext): ManifestContext {
    return ctx.workspace.mono ? {
      workspace: ctx.workspace,
      build: ctx.build,
      main: {
        name: ctx.workspace.name,
        folder: '',
        version: '0.0.0',
      }
    } : ctx;
  }

  /**
   * Produce the manifest context for a given module module
   */
  static getModuleContext(ctx: ManifestContext, folder: string, ensureLatest = false): ManifestContext {
    const modulePath = path.resolve(ctx.workspace.path, folder);
    const pkg = PackageUtil.readPackage(modulePath, ensureLatest);

    return {
      workspace: ctx.workspace,
      build: ctx.build,
      main: {
        name: pkg.name,
        folder,
        version: pkg.version,
        description: pkg.description
      }
    };
  }

  /**
   * Efficient lookup for path-based graphs
   */
  static lookupTrie<T>(
    inputs: T[], getPath: (value: T) => string[], validateUnknown?: (pth: string[]) => boolean
  ): (pth: string[]) => T | undefined {
    type TrieNode = { value?: T, subs: Record<string, TrieNode> };
    const root: TrieNode = { subs: {} };
    for (const item of inputs) {
      const pth = getPath(item);
      let node = root;
      for (const sub of pth) {
        if (sub) {
          node = node.subs[sub] ??= { subs: {} };
        }
      }
      node.value = item;
    }

    return pth => {
      let node = root;
      let value = node.value;
      let i = 0;

      for (const sub of pth) {
        i += 1;
        if (node) {
          node = node.subs[sub];
          value = node?.value ?? value;
        } else if (validateUnknown && !node && !validateUnknown(pth.slice(0, i))) {
          value = undefined;
          break;
        }
      }

      return value;
    };
  }

  /**
   * Update manifest for a given module and relative file, with a specified action
   */
  static updateManifest(manifest: ManifestRoot, moduleName: string, relativeFile: string, action: ChangeEventType): void {
    if (action === 'update') {
      return; // Do nothing
    }
    const folderKey = ManifestModuleUtil.getFolderKey(relativeFile);
    const fileType = ManifestModuleUtil.getFileType(relativeFile);
    const roleType = ManifestModuleUtil.getFileRole(relativeFile)!;

    const manifestModuleFiles = manifest.modules[moduleName].files[folderKey] ??= [];
    const idx = manifestModuleFiles.findIndex(indexedFile => indexedFile[0] === relativeFile);
    const wrappedIdx = idx < 0 ? manifestModuleFiles.length : idx;

    switch (action) {
      case 'create': manifestModuleFiles[wrappedIdx] = [relativeFile, fileType, Date.now(), roleType]; break;
      case 'delete': idx >= 0 && manifestModuleFiles.splice(idx, 1); break;
    }
  }
}