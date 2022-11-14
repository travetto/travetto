import * as path from 'path';
import { log, spawn, BuildConfig } from '../../bin/build-support';

import type { ManifestState } from '@travetto/common';
import { ManifestUtil } from './manifest';

let manifestTemp: string;

/**
 *  Step 2
 */
async function buildManifest(cfg: BuildConfig): Promise<ManifestState> {
  log('[2] Generating Manifest state');
  const state = await ManifestUtil.produceState(process.cwd(), cfg.outputFolder);
  state.manifest.buildLocation = cfg.compilerFolder;
  return state;
}

function shouldRebuildCompiler({ delta }: ManifestState): boolean {
  // Did enough things change to re-stage and build the compiler
  const transformersChanged = Object.values(delta).flatMap(x => x.filter(y => y[0].startsWith('support/transform')));
  const transformerChanged = (delta['@travetto/transformer'] ?? []);
  const compilerChanged = Object.values(delta['@travetto/boot'] ?? []).filter(y => /^support\/bin\//.test(y[0]));

  const changed = transformerChanged.length || transformersChanged.length || compilerChanged.length;
  if (changed) {
    if (compilerChanged.length) {
      log('[3] Changed @travetto/boot', compilerChanged);
    }
    if (transformerChanged.length) {
      log('[3] Changed @travetto/transformer', transformerChanged);
    }
    if (transformersChanged.length) {
      log('[3] Changed */support/transform', transformersChanged);
    }
  }
  return changed > 0;
}

/**
 *  Step 3
 */
async function compilerSetup(state: ManifestState, compilerFolder: string): Promise<void> {
  if (shouldRebuildCompiler(state)) {
    log('[3] Setting up Compiler');
    const args = [
      path.resolve(__dirname, './compiler-setup'),
      (manifestTemp ??= await ManifestUtil.writeState(state)),
      compilerFolder
    ]
    await spawn('Setting up Compiler', process.argv0, { args, cwd: process.cwd() }); // Step 3.b
  } else {
    log('[3] Skipping Compiler Setup');
  }
}

/**
 *  Step 4
 */
async function compileOutput(state: ManifestState, { compilerFolder, outputFolder, watch = false }: BuildConfig): Promise<void> {
  const changes = Object.values(state.delta).flat();
  if (changes.length === 0) {
    log('[4] Skipping Compilation');
    return;
  }

  log('[4] Recompiling Sources', changes);
  const args = [
    `${compilerFolder}/${state.manifest.modules['@travetto/boot'].output}/support/bin/compiler-output`,
    (manifestTemp ??= await ManifestUtil.writeState(state)),
    outputFolder
  ]
  await spawn('Compiling Output', process.argv0, { args, env: { TRV_WATCH: `${watch}` }, cwd: compilerFolder });
}

export async function build(cfg: BuildConfig): Promise<void> {
  const state = await buildManifest(cfg); // Step 2
  await compilerSetup(state, cfg.compilerFolder); // Step 3
  await compileOutput(state, cfg); // Step 4
}