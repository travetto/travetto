import { path } from './path';
import { ManifestModuleUtil } from './module';
import { ManifestFileUtil } from './file';
import { PackageUtil } from './package';

import type { ManifestContext } from './types/context';
import type { ManifestRoot } from './types/manifest';

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
    const prodModules = Object.values(manifest.modules).filter(x => x.prod);
    const prodModNames = new Set([...prodModules.map(x => x.name)]);
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
        prodModules.map(m => [m.name, Object.assign(m, {
          parents: m.parents.filter(x => prodModNames.has(x))
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
      manifest.build.outputFolder = path.cwd();
      manifest.workspace.path = path.cwd();
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
  static getModuleContext(ctx: ManifestContext, folder: string): ManifestContext {
    const modPath = path.resolve(ctx.workspace.path, folder);
    const pkg = PackageUtil.readPackage(modPath);

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
    inputs: T[], getPath: (v: T) => string[], validateUnknown?: (pth: string[]) => boolean
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
}