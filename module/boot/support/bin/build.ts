import { log, spawn } from '../../bin/build-support';

import { ManifestState } from './types';
import { ManifestUtil } from './manifest';

let manifestTemp: string;

/**
 *  Step 2
 */
async function buildManifest(outputFolder: string): Promise<ManifestState> {
  log('[2] Generating Manifest state');
  return await ManifestUtil.produceState(process.cwd(), outputFolder);
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
      require.resolve('./compiler-setup'),
      (manifestTemp ??= await ManifestUtil.writeState(state)),
      compilerFolder
    ]
    await spawn('Setting up Compiler', process.argv0, args, process.cwd(), false); // Step 3.b
  } else {
    log('[3] Skipping Compiler Setup');
  }
}

/**
 *  Step 4
 */
async function compileOutput(state: ManifestState, compilerFolder: string, outputFolder: string): Promise<void> {
  const changes = Object.values(state.delta).flat();
  if (changes.length === 0) {
    log('[4] Skipping Compilation');
    return;
  }

  log('[4] Recompiling Sources', changes);
  const args = [
    `${compilerFolder}/${state.manifest.modules['@travetto/boot'].output}/support/bin/compiler`,
    (manifestTemp ??= await ManifestUtil.writeState(state)),
    outputFolder
  ]
  await spawn('Compiling Output', process.argv0, args, compilerFolder, true);
}

export async function build(outputFolder: string, compilerFolder: string): Promise<void> {
  const state = await buildManifest(outputFolder); // Step 2
  await compilerSetup(state, compilerFolder); // Step 3
  await compileOutput(state, compilerFolder, outputFolder); // Step 4
}