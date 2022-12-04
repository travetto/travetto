import path from 'path';
import fs from 'fs/promises';

import type { ManifestState, ManifestContext, ManifestRoot } from '@travetto/manifest';

import { log, spawn, compileIfStale, getProjectSources, addNodePath, importManifest, IS_DEBUG } from './utils';

let manifestTemp;

/**
 *  Step 1
 */
export async function buildManifest(ctx: ManifestContext): Promise<ManifestState> {
  await compileIfStale(
    ctx,
    '[1] Manifest Bootstrapping',
    await getProjectSources(ctx, '@travetto/manifest'),
  );

  log('[1] Manifest Generation');
  const { ManifestUtil } = await importManifest(ctx);
  return ManifestUtil.produceState(ctx);
}

export async function writeManifest(ctx: ManifestContext, manifest: ManifestRoot): Promise<void> {
  // Write manifest in the scenario we are in mono-repo state where everything pre-existed
  await fs.writeFile(
    path.resolve(
      ctx.workspacePath,
      ctx.outputFolder,
      ctx.manifestFile
    ),
    JSON.stringify(manifest)
  );
}

function shouldRebuildCompiler({ delta }: ManifestState): { total: boolean, transformers: [string, string][] } {
  // Did enough things change to re-stage and build the compiler
  const transformersChanged = Object.entries(delta)
    .flatMap(([mod, files]) => files.map(([file]) => [mod, file]))
    .filter((ev): ev is [string, string] => ev[1].startsWith('support/transform'));
  const transformerChanged = (delta['@travetto/transformer'] ?? []);
  const compilerChanged = delta['@travetto/compiler'] ?? [];

  const changed = transformerChanged.length || transformersChanged.length || compilerChanged.length;
  if (changed) {
    if (compilerChanged.length) {
      log('[2] Compiler source changed @travetto/compiler', compilerChanged);
    }
    if (transformerChanged.length) {
      log('[2] Compiler source changed @travetto/transformer', transformerChanged);
    }
    if (transformersChanged.length) {
      log('[2] Compiler source changed */support/transform', transformersChanged);
    }
  }
  return { total: changed > 0, transformers: transformersChanged };
}

/**
 *  Step 2
 */
async function buildCompiler(state: ManifestState, ctx: ManifestContext): Promise<void> {
  await compileIfStale(
    ctx,
    '[2] Compiler Bootstrapping',
    await getProjectSources(ctx, '@travetto/compiler'),
  );

  await compileIfStale(
    ctx,
    '[2] Compiler Bootstrapping',
    await getProjectSources(ctx, '@travetto/transformer'),
  );

  const changed = shouldRebuildCompiler(state);

  if (changed.transformers.length) {
    state = await buildManifest(ctx);
    let x = 0;
    for (const [mod, file] of changed.transformers) {
      await compileIfStale(
        ctx,
        `[2.${x += 1}] ${file} Bootstrapping`,
        await getProjectSources(ctx, mod, ['package.json', file])
      );
    }
  }

  log('[2] Compiler Ready');
}

/**
 *  Step 4
 */
async function compileOutput(state: ManifestState, ctx: ManifestContext, watch?: boolean): Promise<void> {
  let changes = Object.values(state.delta).flat();

  // Remove files that should go away
  await Promise.all(changes.filter(x => x[1] === 'removed')
    .map(([f]) => fs.unlink(path.resolve(ctx.workspacePath, ctx.outputFolder, f)).catch(() => { })));

  changes = changes.filter(x => x[1] !== 'removed');

  if (changes.length === 0 && !watch) {
    log('[3] Output Ready');
    return await writeManifest(ctx, state.manifest);
  }

  const { ManifestUtil } = await importManifest(ctx);
  log('[3] Changed Sources', changes);
  const args = [
    path.resolve(
      ctx.workspacePath,
      ctx.compilerFolder,
      state.manifest.modules['@travetto/compiler'].output,
      'support/main.output'
    ),
    (manifestTemp ??= await ManifestUtil.writeState(state))
  ];
  await spawn('[3] Compiling', process.argv0, {
    args, env: { TRV_WATCH: `${!!watch}` },
    cwd: path.resolve(
      ctx.workspacePath,
      ctx.compilerFolder,
    ),
    showWaitingMessage: !watch && !IS_DEBUG
  });
}

export async function compile(ctx: ManifestContext, watch?: boolean): Promise<void> {
  const state = await buildManifest(ctx); // Step 1
  await buildCompiler(state, ctx); // Step 2
  await compileOutput(state, ctx, watch); // Step 3
  await addNodePath(path.resolve(ctx.workspacePath, ctx.outputFolder));
}