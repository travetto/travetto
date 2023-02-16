import fs from 'fs/promises';
import path from 'path';

import type { ManifestContext } from '@travetto/manifest';
import { CompileResult, TranspileUtil } from './transpile';

const SOURCE_SEED = ['package.json', 'index.ts', '__index__.ts', 'src', 'support', 'bin'];
const PRECOMPILE_MODS = ['@travetto/terminal', '@travetto/manifest', '@travetto/transformer', '@travetto/compiler'];

const importManifest = (ctx: ManifestContext): Promise<typeof import('@travetto/manifest')> =>
  import(path.resolve(ctx.workspacePath, ctx.compilerFolder, 'node_modules', '@travetto/manifest/__index__.js'));

/**
 * Recompile folder if stale
 */
async function compileIfStale(ctx: ManifestContext, scope: string, mod: string, seed: string[]): Promise<string[]> {
  const files = await TranspileUtil.getModuleSources(ctx, mod, seed);
  const changes = files.filter(x => x.stale).map(x => x.input);
  const out: string[] = [];

  try {
    await TranspileUtil.withLogger(scope, async log => {
      if (files.some(f => f.stale)) {
        log('debug', 'Starting');
        for (const file of files.filter(x => x.stale)) {
          await TranspileUtil.transpileFile(ctx, file.input, file.output);
        }
        if (changes.length) {
          out.push(...changes.map(x => `${mod}/${x}`));
          log('debug', `Source changed: ${changes.join(', ')}`);
        }
        log('debug', 'Completed');
      } else {
        log('debug', 'Skipped');
      }
    }, false, [mod]);
  } catch (err) {
    console.error(err);
  }
  return out;
}

/**
 * Run the compiler
 */
async function compile(ctx: ManifestContext, op?: 'watch' | 'build'): Promise<CompileResult> {
  let changes = 0;

  await TranspileUtil.withLogger('precompile', async () => {
    for (const mod of PRECOMPILE_MODS) {
      changes += (await compileIfStale(ctx, 'precompile', mod, SOURCE_SEED)).length;
    }
  });

  const { ManifestUtil, ManifestDeltaUtil } = await importManifest(ctx);

  const manifest = await TranspileUtil.withLogger('manifest', async () => ManifestUtil.buildManifest(ctx));

  await TranspileUtil.withLogger('transformers', async () => {
    for (const mod of Object.values(manifest.modules).filter(m => m.files.$transformer?.length)) {
      changes += (await compileIfStale(ctx, 'transformers', mod.name, ['package.json', ...mod.files.$transformer!.map(x => x[0])])).length;
    }
  });

  const delta = await TranspileUtil.withLogger('delta', async log => {
    if (changes) {
      log('debug', 'Skipping, everything changed');
      return [{ type: 'changed', file: '*', module: ctx.mainModule } as const];
    } else {
      return ManifestDeltaUtil.produceDelta(ctx, manifest);
    }
  });

  if (changes) {
    await TranspileUtil.withLogger('reset', async log => {
      await fs.rm(path.resolve(ctx.workspacePath, ctx.outputFolder), { recursive: true, force: true });
      log('info', 'Clearing output due to compiler changes');
    }, false);
  }

  // Write manifest
  await TranspileUtil.withLogger('manifest', async log => {
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
      log('debug', `Changes triggered ${delta.map(x => `${x.type}:${x.module}:${x.file}`)}`);
      log('debug', `Rewrote monorepo manifests [changes=${delta.length}] ${names.join(', ')}`);
    }
  });

  return await TranspileUtil.withLogger('compile', async log => {
    const changed = delta.filter(x => x.type === 'added' || x.type === 'changed');
    log('debug', `Started action=${op} changed=${changed.map(x => `${x.module}/${x.file}`)}`);
    if (changed.length || op === 'watch') {
      const res = await TranspileUtil.runCompiler(ctx, manifest, changed, op === 'watch');
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
    TranspileUtil.log('manifest', [], 'info', `Wrote manifest ${output}`);
  } else {
    console.log(JSON.stringify(manifest, null, 2));
  }
}

/**
 * Launch
 */
export async function launch(ctx: ManifestContext, op?: 'build' | 'watch' | 'manifest', args: (string | undefined)[] = []): Promise<void> {
  if (op !== 'manifest') {
    let action: CompileResult = 'restart';
    while (action === 'restart') {
      action = await compile(ctx, op);
    }
  }
  switch (op) {
    case 'manifest': return exportManifest(ctx, ...args);
    case 'build': return TranspileUtil.log('build', [], 'info', 'Successfully built');
    case undefined: {
      // TODO: Externalize somehow?
      const outputPath = path.resolve(ctx.workspacePath, ctx.outputFolder);
      process.env.TRV_MANIFEST = path.resolve(outputPath, 'node_modules', ctx.mainModule);
      const cliMain = path.join(outputPath, 'node_modules', '@travetto/cli/support/cli.js');
      return import(cliMain);
    }
  }
}