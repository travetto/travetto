import fs from 'fs/promises';
import os from 'os';

import { path } from './path';
import { ManifestModule, ManifestRoot, ManifestState } from './types';

import { ManifestModuleUtil } from './module';
import { ManifestDeltaUtil } from './delta';

/**
 * Manifest utils
 */
export class ManifestUtil {

  /**
   * Utility for manifest boilerplate
   */
  static wrapModules(modules: Record<string, ManifestModule>): ManifestRoot {
    return {
      main: Object.values(modules).find(x => x.main)?.name ?? '__tbd__',
      modules, generated: Date.now(),
      buildLocation: '__tbd__'
    };
  }

  /**
   * Produce manifest in memory
   */
  static async buildManifest(rootFolder: string): Promise<ManifestRoot> {
    return this.wrapModules(await ManifestModuleUtil.produceModules(rootFolder));
  }

  /**
   * Read manifest from a folder
   */
  static async readManifest(folder: string): Promise<ManifestRoot> {
    const file = path.resolve(folder, 'manifest.json');
    if (await fs.stat(file).catch(() => false)) {
      return JSON.parse(
        await fs.readFile(file, 'utf8')
      );
    } else {
      return this.wrapModules({});
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
  static async produceState(rootFolder: string, outputFolder: string): Promise<ManifestState> {
    const manifest = await this.buildManifest(rootFolder);
    const oldManifest = await this.readManifest(outputFolder);
    const delta = await ManifestDeltaUtil.produceDelta(outputFolder, manifest, oldManifest);
    return { manifest, delta };
  }
}