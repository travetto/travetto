import fs from 'fs/promises';

import type { ManifestState } from '@travetto/manifest';

import { log, spawn, compileIfStale, getProjectSources, addNodePath, importManifest } from './utils';

import type { CompileContext } from '../../bin/transpile';

let manifestTemp;

/**
 *  Step 1
 */
async function buildManifest(ctx: CompileContext): Promise<ManifestState> {
  await compileIfStale(
    ctx,
    '[1] Manifest Bootstrapping',
    await getProjectSources(ctx, '@travetto/manifest'),
  );

  log('[1] Manifest Generation');
  const { ManifestUtil } = await importManifest(ctx.compilerFolder);
  const state = await ManifestUtil.produceState(process.cwd(), ctx.outputFolder);
  state.manifest.buildLocation = ctx.compilerFolder;
  return state;
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
async function buildCompiler(state: ManifestState, ctx: CompileContext): Promise<void> {
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
    log('[2] Clearing output: */support/transform changed');
    // Delete all output on transformer changes
    await fs.rm(ctx.outputFolder, { recursive: true, force: true }).catch(() => { });
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
async function compileOutput(state: ManifestState, ctx: CompileContext): Promise<void> {
  const changes = Object.values(state.delta).flat();
  if (changes.length === 0 && ctx.op === 'build') {
    log('[3] Output Ready');
    return;
  }

  log('[3] Changed Sources', changes);
  const { ManifestUtil } = await importManifest(ctx.compilerFolder);
  const args = [
    `${ctx.compilerFolder}/${state.manifest.modules['@travetto/compiler'].output}/support/main.output`,
    (manifestTemp ??= await ManifestUtil.writeState(state)),
    ctx.outputFolder
  ];
  await spawn('[3] Compiling', process.argv0, {
    args, env: { TRV_WATCH: `${ctx.op === 'watch'}` },
    cwd: ctx.compilerFolder,
    showWaitingMessage: ctx.op === 'build' && !process.env.DEBUG
  });
}

export async function compile(ctx: CompileContext): Promise<void> {

  // Skip compilation if not installed
  if (ctx.compiled !== true) {
    const state = await buildManifest(ctx); // Step 1
    await buildCompiler(state, ctx); // Step 2
    await compileOutput(state, ctx); // Step 3
  }

  // Only  manipulate if we aren't in the output folder
  if (ctx.outputFolder !== ctx.cwd) {
    await addNodePath(ctx.outputFolder);
  }

  // Share back so ModuleIndex will pick it up
  process.env.TRV_OUTPUT = ctx.outputFolder;
}