import fs from 'fs/promises';
import os from 'os';

import { path } from './path';
import { ManifestContext, ManifestRoot, ManifestState } from './types';

import { ManifestModuleUtil } from './module';
import { ManifestDeltaUtil } from './delta';

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
   * Read manifest from a folder
   */
  static async readManifest(ctx: ManifestContext): Promise<ManifestRoot> {
    const file = path.resolve(ctx.workspacePath, ctx.outputFolder, ctx.manifestFile);
    if (await fs.stat(file).catch(() => false)) {
      return JSON.parse(await fs.readFile(file, 'utf8'));
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
   * Persist state to disk in a temp file, return said temp file
   */
  static async writeState(state: ManifestState, file?: string): Promise<string> {
    const manifestTemp = file ?? path.resolve(os.tmpdir(), `manifest-state.${Date.now()}${Math.random()}.json`);
    await fs.writeFile(manifestTemp, JSON.stringify(state), 'utf8');
    return manifestTemp;
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
}