import { path } from './path';
import { ManifestContext, ManifestRoot } from './types';
import { ManifestModuleUtil } from './module';
import { ManifestFileUtil } from './file';
import { PackageUtil } from './package';

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
      modules: await ManifestModuleUtil.produceModules(ctx),
      generated: Date.now(),
      ...ctx
    };
  }

  /**
   * Produce a production manifest from a given manifest
   */
  static createProductionManifest(manifest: ManifestRoot): ManifestRoot {
    return {
      ...manifest,
      // If in prod mode, only include std modules
      modules: Object.fromEntries(
        Object.values(manifest.modules)
          .filter(x => x.prod)
          .map(m => [m.name, m])
      ),
      build: {
        ...manifest.build,
        // Mark output folder/workspace path as portable
        outputFolder: '$$PRODUCTION$$',
      }
    };
  }

  /**
   * Read manifest, synchronously
   *
   * @param file
   * @returns
   */
  static readManifestSync(file: string): { manifest: ManifestRoot, file: string } {
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
    return { manifest, file };
  }

  /**
   * Write manifest for a given context, return location
   */
  static writeManifest(manifest: ManifestRoot): Promise<string> {
    return ManifestFileUtil.bufferedFileWrite(
      path.resolve(manifest.workspace.path, manifest.build.outputFolder, 'node_modules', manifest.main.name, MANIFEST_FILE),
      JSON.stringify(manifest)
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
      ...ctx,
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
      ...ctx,
      main: {
        name: pkg.name,
        folder,
        version: pkg.version,
        description: pkg.description
      }
    };
  }
}