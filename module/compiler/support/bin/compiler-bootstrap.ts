import path from 'path';
import fs from 'fs/promises';
import cp from 'child_process';

import type { ManifestState, ManifestContext, ManifestRoot } from '@travetto/manifest';

import { log, compileIfStale, getProjectSources, addNodePath, importManifest } from './utils';

const PRECOMPILE_MODS = [
  '@travetto/terminal',
  '@travetto/manifest',
  '@travetto/transformer',
  '@travetto/compiler'
];

let manifestTemp;

/**
 * Step 0
 */
export async function precompile(ctx: ManifestContext): Promise<void> {
  for (const mod of PRECOMPILE_MODS) {
    await compileIfStale(ctx, `[0] Compiling ${mod}`, await getProjectSources(ctx, mod),);
  }
}

export async function writeManifest(ctx: ManifestContext, manifest: ManifestRoot): Promise<void> {
  const { ManifestUtil } = await importManifest(ctx);
  return ManifestUtil.writeManifest(ctx, manifest);
}

async function rewriteManifests(ctx: ManifestContext, state: ManifestState): Promise<void> {
  const { ManifestUtil } = await importManifest(ctx);

  // Write out all changed manifests
  const { getContext } = await import('../../bin/transpile');

  const dirtyModules = [...Object.entries(state.delta)].filter(x => x[1].length > 0).map(([mod]) => mod);
  for (const module of dirtyModules) {
    const subCtx = await getContext(state.manifest.modules[module].source);
    await ManifestUtil.createAndWriteManifest(subCtx);
  }
}

/**
 *  Step 1
 */
export async function buildManifest(ctx: ManifestContext): Promise<ManifestState> {
  log('[1] Manifest Generation');
  const { ManifestUtil } = await importManifest(ctx);
  return ManifestUtil.produceState(ctx);
}

function shouldRebuildCompiler({ delta }: ManifestState): { total: boolean, transformers: [string, string][] } {
  // Did enough things change to re-stage and build the compiler
  const transformersChanged = Object.entries(delta)
    .flatMap(([mod, files]) => files.map(x => [mod, x.file]))
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
  await Promise.all(changes.filter(x => x.type === 'removed')
    .map(x => fs.unlink(path.resolve(ctx.workspacePath, ctx.outputFolder, x.file)).catch(() => { })));

  changes = changes.filter(x => x.type !== 'removed');

  const { ManifestUtil } = await importManifest(ctx);
  const resolve = ManifestUtil.resolveFile.bind(null, ctx, state.manifest, '@travetto/compiler');

  manifestTemp ??= await ManifestUtil.writeState(state);
  const cwd = path.resolve(ctx.workspacePath, ctx.compilerFolder);

  if (changes.length) {
    log('[3] Changed Sources', changes);

    // Blocking call, compile only
    const res = cp.spawnSync(process.argv0,
      [resolve('support/compile'), manifestTemp],
      { cwd, stdio: 'inherit', encoding: 'utf8' }
    );

    if (res.status) {
      throw new Error(res.stderr);
    }

    await rewriteManifests(ctx, state);
  }

  if (watch) {
    // Rewrite state with updated manifest
    const newState = await ManifestUtil.produceState(ctx);
    manifestTemp = await ManifestUtil.writeState(newState);

    // Run with watching
    cp.spawnSync(process.argv0,
      [resolve('support/compile'), manifestTemp, 'true'], { cwd, stdio: 'inherit' }
    );
  }
}

export async function compile(ctx: ManifestContext, watch?: boolean): Promise<ManifestState> {
  await precompile(ctx); // Step 0
  const state = await buildManifest(ctx); // Step 1
  await buildCompiler(state, ctx); // Step 2
  await compileOutput(state, ctx, watch); // Step 3
  await addNodePath(path.resolve(ctx.workspacePath, ctx.outputFolder));
  return state;
}