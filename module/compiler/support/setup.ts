import { type DeltaEvent, type ManifestContext, ManifestDeltaUtil, ManifestUtil } from '@travetto/manifest';

import { Log } from './log.ts';

/**
 * Compiler Setup Utilities
 */
export class CompilerSetup {

  /**
   * Export manifest
   */
  static async exportManifest(ctx: ManifestContext, output?: string, prod?: boolean): Promise<void> {
    let manifest = await ManifestUtil.buildManifest(ctx);

    // If in prod mode, only include std modules
    if (prod) {
      manifest = ManifestUtil.createProductionManifest(manifest);
    }
    if (output) {
      output = await ManifestUtil.writeManifestToFile(output, manifest);
    } else {
      console.log(JSON.stringify(manifest, null, 2));
    }
  }

  /**
   * Sets up compiler, and produces a set of changes that need to be processed
   */
  static async setup(ctx: ManifestContext): Promise<DeltaEvent[]> {
    const manifest = await Log.wrap('manifest', () =>
      ManifestUtil.buildManifest(ManifestUtil.getWorkspaceContext(ctx)));

    const delta = await Log.wrap('delta', async () =>
      ManifestDeltaUtil.produceDelta(manifest)
    );

    // Write manifest
    await Log.wrap('manifest', async log => {
      await ManifestUtil.writeManifest(manifest);
      log.debug(`Wrote manifest ${ctx.workspace.name}`);

      // Update all manifests when in mono repo
      if (delta.length && ctx.workspace.mono) {
        const names: string[] = [];
        const mods = Object.values(manifest.modules).filter(mod => mod.workspace && mod.name !== ctx.workspace.name);
        for (const mod of mods) {
          const modCtx = ManifestUtil.getModuleContext(ctx, mod.sourceFolder, true);
          const modManifest = await ManifestUtil.buildManifest(modCtx);
          await ManifestUtil.writeManifest(modManifest);
          names.push(mod.name);
        }
        log.debug(`Changes triggered ${delta.slice(0, 10).map(event => `${event.type}:${event.module}:${event.file}`)}`);
        log.debug(`Rewrote monorepo manifests [changes=${delta.length}] ${names.slice(0, 10).join(', ')}`);
      }
    });

    return delta.filter(event => event.type === 'create' || event.type === 'update');
  }
}