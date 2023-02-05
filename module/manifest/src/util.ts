import fs from 'fs/promises';
import os from 'os';

import { path } from './path';
import { ManifestContext, ManifestRoot, ManifestState, MANIFEST_FILE, MANIFEST_STATE_FILE } from './types';

import { ManifestModuleUtil } from './module';
import { ManifestDeltaUtil } from './delta';

/**
 * Manifest utils
 */
export class ManifestUtil {

  static async writeJsonWithBuffer(ctx: ManifestContext, filename: string, obj: object): Promise<string> {
    const file = path.resolve(ctx.workspacePath, ctx.mainOutputFolder, filename);
    await fs.mkdir(path.dirname(file), { recursive: true });
    const temp = path.resolve(os.tmpdir(), `${file.replace(/[\/\\: ]/g, '_')}.${Date.now()}`);
    await fs.writeFile(temp, JSON.stringify(obj), 'utf8');
    await fs.copyFile(temp, file);
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
   * Generate manifest for a given context, and persist
   */
  static async createAndWriteManifest(ctx: ManifestContext): Promise<string> {
    const manifest = await this.buildManifest(ctx);
    return this.writeManifest(ctx, manifest);
  }

  /**
   * Read manifest from a folder
   */
  static async readManifest(ctx: ManifestContext): Promise<ManifestRoot> {
    const file = path.resolve(ctx.workspacePath, ctx.mainOutputFolder, MANIFEST_FILE);
    if (await fs.stat(file).catch(() => false)) {
      try {
        return JSON.parse(await fs.readFile(file, 'utf8'));
      } catch (err) {
        await fs.unlink(file).catch(() => { });
        const final = new Error(`Corrupted manifest ${ctx.mainOutputFolder}/${MANIFEST_FILE}: file has been removed, retry`);
        if (err instanceof Error) {
          final.stack = [final.message, ...(err.stack ?? '').split('\n').slice(1)].join('\n');
        }
        throw final;
      }
    } else {
      return {
        modules: {},
        generated: Date.now(),
        ...ctx,
      };
    }
  }

  /**
   * Load state from disk
   */
  static async readState(file: string): Promise<ManifestState> {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  }

  /**
   * Generate the manifest and delta as a single output
   */
  static async produceState(ctx: ManifestContext): Promise<ManifestState> {
    const manifest = await this.buildManifest(ctx);
    const oldManifest = await this.readManifest(ctx);
    const delta = await ManifestDeltaUtil.produceDelta(
      path.resolve(manifest.workspacePath, ctx.outputFolder),
      manifest,
      oldManifest
    );
    return { manifest, delta };
  }

  /**
   * Resolves a module file, from a context and manifest
   */
  static resolveFile(ctx: ManifestContext, manifest: ManifestRoot, module: string, file: string): string {
    return path.resolve(
      ctx.workspacePath,
      ctx.compilerFolder,
      manifest.modules[module].output,
      file
    );
  }

  /**
   * Persist state to disk in a temp file, return said temp file
   */
  static async writeState(ctx: ManifestContext, state: ManifestState): Promise<string> {
    const temp = path.resolve(os.tmpdir(), `${MANIFEST_STATE_FILE}.${Date.now()}.${Math.random()}`);
    await fs.writeFile(temp, JSON.stringify(state), 'utf8');
    return temp;
  }

  /**
   * Write manifest for a given context, return location
   */
  static writeManifest(ctx: ManifestContext, manifest: ManifestRoot): Promise<string> {
    return this.writeJsonWithBuffer(ctx, MANIFEST_FILE, manifest);
  }
}