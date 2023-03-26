import fs from 'fs/promises';
import path from 'path';

import type { ManifestContext } from '@travetto/manifest';

import { TranspileUtil, CompileResult, BuildEvent } from './transpile';
import { LockManager } from './lock';
import { LogUtil } from './log';

const SOURCE_SEED = ['package.json', 'index.ts', '__index__.ts', 'src', 'support', 'bin'];
const PRECOMPILE_MODS = ['@travetto/terminal', '@travetto/manifest', '@travetto/transformer', '@travetto/compiler'];

const importManifest = (ctx: ManifestContext): Promise<typeof import('@travetto/manifest')> =>
  import(path.resolve(ctx.workspacePath, ctx.compilerFolder, 'node_modules', '@travetto/manifest/__index__.js'));

/**
 * Run the compiler
 */
async function compile(ctx: ManifestContext, op: 'watch' | 'build' | undefined, onMessage: (msg: BuildEvent) => void): Promise<CompileResult> {
  let changes = 0;

  await LogUtil.withLogger('precompile', async () => {
    for (const mod of PRECOMPILE_MODS) {
      const count = (await TranspileUtil.compileIfStale(ctx, 'precompile', mod, SOURCE_SEED)).length;
      if (mod !== '@travetto/terminal') {
        changes += count;
      }
    }
  });

  const { ManifestUtil, ManifestDeltaUtil, PackageUtil } = await importManifest(ctx);

  PackageUtil.clearCache();

  const manifest = await LogUtil.withLogger('manifest', async () => ManifestUtil.buildManifest(ctx));

  await LogUtil.withLogger('transformers', async () => {
    for (const mod of Object.values(manifest.modules).filter(m => m.files.$transformer?.length)) {
      changes += (await TranspileUtil.compileIfStale(ctx, 'transformers', mod.name, ['package.json', ...mod.files.$transformer!.map(x => x[0])])).length;
    }
  });

  const delta = await LogUtil.withLogger('delta', async log => {
    if (changes) {
      log('debug', 'Skipping, everything changed');
      return [{ type: 'changed', file: '*', module: ctx.mainModule } as const];
    } else {
      return ManifestDeltaUtil.produceDelta(ctx, manifest);
    }
  });

  if (changes) {
    await LogUtil.withLogger('reset', async log => {
      await fs.rm(path.resolve(ctx.workspacePath, ctx.outputFolder), { recursive: true, force: true });
      log('info', 'Clearing output due to compiler changes');
    }, false);
  }

  // Write manifest
  await LogUtil.withLogger('manifest', async log => {
    await ManifestUtil.writeManifest(ctx, manifest);
    log('debug', `Wrote manifest ${ctx.mainModule}`);

    // Update all manifests
    if (delta.length && ctx.monoRepo && !ctx.mainFolder) {
      const names: string[] = [];
      const mods = Object.values(manifest.modules).filter(x => x.local && x.name !== ctx.mainModule);
      for (const mod of mods) {
        await ManifestUtil.rewriteManifest(path.resolve(ctx.workspacePath, mod.sourceFolder));
        names.push(mod.name);
      }
      log('debug', `Changes triggered ${delta.slice(0, 10).map(x => `${x.type}:${x.module}:${x.file}`)}`);
      log('debug', `Rewrote monorepo manifests [changes=${delta.length}] ${names.slice(0, 10).join(', ')}`);
    }
  });

  return await LogUtil.withLogger('compile', async log => {
    const changed = delta.filter(x => x.type === 'added' || x.type === 'changed');
    log('debug', `Started action=${op} changed=${changed.slice(0, 10).map(x => `${x.module}/${x.file}`)}`);
    if (changed.length || op === 'watch') {
      const res = await TranspileUtil.runCompiler(ctx, manifest, changed, op === 'watch', onMessage);
      log('debug', 'Finished');
      return res;
    } else {
      log('debug', 'Skipped');
      return 'skipped';
    }
  }, false);
}

/**
 * Export manifests
 */
async function exportManifest(ctx: ManifestContext, output?: string, env = 'dev'): Promise<void> {
  const { ManifestUtil } = await importManifest(ctx);
  let manifest = await ManifestUtil.buildManifest(ctx);

  // If in prod mode, only include std modules
  if (/^prod/i.test(env)) {
    manifest = ManifestUtil.createProductionManifest(manifest);
  }
  if (output) {
    output = await ManifestUtil.writeManifestToFile(output, manifest);
    LogUtil.log('manifest', [], 'info', `Wrote manifest ${output}`);
  } else {
    console.log(JSON.stringify(manifest, null, 2));
  }
}

/**
 * Launch
 */
export async function launch(ctx: ManifestContext, root: ManifestContext, op?: 'build' | 'watch' | 'manifest', args: (string | undefined)[] = []): Promise<void> {
  // If quiet enabled, turn off all output by default
  LogUtil.level = process.env.TRV_BUILD ?? (process.env.TRV_QUIET ? 'none' : (!op ? 'warn' : 'info'));

  if (op !== 'manifest' && await LockManager.getCompileAction(root, op) === 'build') {

    // Ready signal
    if (process.send) {
      process.send('ready');
      process.on('disconnect', () => process.exit(0));
    }

    await LockManager.withLocks(root, async (acquire, release) => {
      let action: CompileResult;
      do {
        acquire(op ?? 'build');
        if (op === 'watch') {
          acquire('build');
        }
        action = await compile(root, op, msg => {
          switch (msg.type) {
            case 'complete': {
              release('build');
              break;
            }
          }
        });
      } while (action === 'restart');
    });
  }

  // Disconnect for non-cli operations
  if (op && process.send) {
    process.disconnect();
  }

  switch (op) {
    case 'manifest': return exportManifest(ctx, ...args);
    case 'build': return LogUtil.log('build', [], 'info', 'Successfully built');
    case undefined: {
      // TODO: Externalize somehow?
      const outputPath = path.resolve(ctx.workspacePath, ctx.outputFolder);
      process.env.TRV_MANIFEST = path.resolve(outputPath, 'node_modules', ctx.mainModule);
      const cliMain = path.join(outputPath, 'node_modules', '@travetto/cli/support/entry.cli.js');
      return import(cliMain);
    }
  }
}