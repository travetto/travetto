import { readFileSync } from 'fs';
import fs from 'fs/promises';
import os from 'os';

import { path } from './path';
import { ManifestContext, ManifestRoot } from './types';
import { ManifestModuleUtil } from './module';

const MANIFEST_FILE = 'manifest.json';

/**
 * Manifest utils
 */
export class ManifestUtil {

  static async writeJsonWithBuffer(ctx: ManifestContext, filename: string, obj: object): Promise<string> {
    const tempName = path.resolve(ctx.workspacePath, ctx.mainFolder, filename).replace(/[\/\\: ]/g, '_');
    const file = path.resolve(ctx.workspacePath, ctx.outputFolder, 'node_modules', ctx.mainModule, filename);
    await fs.mkdir(path.dirname(file), { recursive: true });
    const temp = path.resolve(os.tmpdir(), `${tempName}.${Date.now()}`);
    await fs.writeFile(temp, JSON.stringify(obj), 'utf8');
    await fs.copyFile(temp, file);
    fs.unlink(temp);
    return file;
  }

  /**
   * Build a manifest context
   * @param folder
   */
  static async buildContext(folder?: string): Promise<ManifestContext> {
    const { getManifestContext } = await import('../bin/context.js');
    return getManifestContext(folder);
  }

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
          .filter(x => x.profiles.includes('std'))
          .map(m => [m.name, m])
      ),
      // Mark output folder/workspace path as portable
      outputFolder: '',
      workspacePath: '',
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
    const manifest: ManifestRoot = JSON.parse(readFileSync(file, 'utf8'));
    if (!manifest.outputFolder) {
      manifest.outputFolder = path.cwd();
      manifest.workspacePath = path.cwd();
    }
    return { manifest, file };
  }

  /**
   * Write manifest for a given context, return location
   */
  static writeManifest(ctx: ManifestContext, manifest: ManifestRoot): Promise<string> {
    return this.writeJsonWithBuffer(ctx, MANIFEST_FILE, manifest);
  }

  /**
   * Write a manifest to a specific file, if no file extension provided, the file is assumed to be a folder
   */
  static async writeManifestToFile(location: string, manifest: ManifestRoot): Promise<string> {
    if (!location.endsWith('.json')) {
      location = path.resolve(location, MANIFEST_FILE);
    }

    await fs.mkdir(path.dirname(location));
    await fs.writeFile(location, JSON.stringify(manifest), 'utf8');

    return location;
  }

  /**
   * Rewrite manifest for a given folder
   */
  static async rewriteManifest(source: string): Promise<void> {
    const subCtx = await this.buildContext(source);
    const subManifest = await this.buildManifest(subCtx);
    await this.writeManifest(subCtx, subManifest);
  }
}