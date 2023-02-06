import fs from 'fs/promises';
import path from 'path';
import cp from 'child_process';

import type { ManifestRoot, ManifestContext } from '@travetto/manifest';

import { log, compileIfStale, getProjectSources, addNodePath, importManifest, shouldRebuildCompiler } from './utils';
import { ManifestDelta, ManifestDeltaUtil } from './delta';

const PRECOMPILE_MODS = [
  '@travetto/terminal',
  '@travetto/manifest',
  '@travetto/transformer',
  '@travetto/compiler'
];

/**
 * Step 0
 */
export async function precompile(ctx: ManifestContext): Promise<void> {
  for (const mod of PRECOMPILE_MODS) {
    await compileIfStale(ctx, `[0] Compiling ${mod}`, await getProjectSources(ctx, mod),);
  }
}

export async function createAndWriteManifest(ctx: ManifestContext, output: string, env: string = 'dev'): Promise<void> {
  const { ManifestUtil } = await importManifest(ctx);
  const manifest = await ManifestUtil.buildManifest(ctx);

  // If in prod mode, only include std modules
  if (/^prod/i.test(env)) {
    manifest.modules = Object.fromEntries(
      Object.values(manifest.modules)
        .filter(x => x.profiles.includes('std'))
        .map(m => [m.name, m])
    );
  }
  await fs.writeFile(output, JSON.stringify(manifest));
}

/**
 *  Step 1
 */
async function buildManifest(ctx: ManifestContext): Promise<ManifestRoot> {
  log('[1] Manifest Generation');
  const { ManifestUtil } = await importManifest(ctx);
  const manifest = await ManifestUtil.buildManifest(ctx);
  const loc = await ManifestUtil.writeManifest(ctx, manifest);
  log('[1] Manifest Generated', loc);
  return manifest;
}

/**
 *  Step 2
 */
async function buildCompiler(ctx: ManifestContext, delta: ManifestDelta): Promise<void> {
  const changed = await shouldRebuildCompiler(delta);

  if (changed.total) {
    if (changed.compiler.length) {
      log('[2] Compiler source changed @travetto/compiler', changed.compiler);
    }
    if (changed.transformer.length) {
      log('[2] Compiler source changed @travetto/transformer', changed.transformer);
    }
    if (changed.transformers.length) {
      log('[2] Compiler source changed */support/transform', changed.transformers);
    }
  }

  if (changed.transformers.length) {
    let x = 0;
    for (const [mod, file] of changed.transformers) {
      await compileIfStale(
        ctx,
        `[2.${x += 1}] ${file} Bootstrapping`,
        await getProjectSources(ctx, mod, ['package.json', file])
      );
    }
  }

  // Clean output if compiler changed
  if (changed.total) {
    await fs.rm(path.resolve(ctx.workspacePath, ctx.outputFolder), { recursive: true, force: true });
    // Re-write manifest
    await buildManifest(ctx);
  }

  log('[2] Compiler Ready');
}

/**
 *  Step 3
 */
async function compileOutput(ctx: ManifestContext, manifest: ManifestRoot, delta: ManifestDelta, watch?: boolean): Promise<void> {
  log('[3] Compiling');

  const changed = Object.values(delta).some(x => x.length > 0);

  // Update all manifests
  if (changed && ctx.monoRepo && ctx.workspacePath === ctx.mainPath) {
    for (const mod of Object.keys(manifest.modules)) {
      if (mod !== ctx.mainModule && manifest.modules[mod].local) {
        const { ManifestUtil } = await importManifest(ctx);
        const subCtx = await ManifestUtil.buildContext(manifest.modules[mod].source);
        const subManifest = await ManifestUtil.buildManifest(subCtx);
        await ManifestUtil.writeManifest(subCtx, subManifest);
      }
    }
    log('[3] Rewrote monorepo manifests');
  }

  // Blocking call, compile only
  if (changed || watch) {
    const cwd = path.resolve(ctx.workspacePath, ctx.compilerFolder);
    const src = path.resolve(cwd, 'node_modules', '@travetto/compiler/support/compile');
    const args = [src, ...(watch ? ['true'] : [])];
    const res = cp.spawnSync(process.argv0, args, {
      env: { TRV_MANIFEST: path.resolve(ctx.workspacePath, ctx.mainOutputFolder), TRV_THROW_ROOT_INDEX_ERR: '1' },
      cwd,
      stdio: 'inherit',
      encoding: 'utf8'
    });
    if (res.status) {
      throw new Error(res.stderr);
    }
  }
  log('[3] Compiled', path.resolve(ctx.workspacePath, ctx.mainOutputFolder));
}

export async function compile(ctx: ManifestContext, watch?: boolean): Promise<ManifestRoot> {
  await precompile(ctx); // Step 0
  const manifest = await buildManifest(ctx); // Step 1
  const output = path.resolve(ctx.workspacePath, ctx.outputFolder);
  const delta = await ManifestDeltaUtil.produceDelta(output, manifest);
  await buildCompiler(ctx, delta); // Step 2
  await compileOutput(ctx, manifest, delta, watch); // Step 3
  await addNodePath(output);
  return manifest;
}