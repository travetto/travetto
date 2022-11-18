import * as fs from 'fs/promises';

import type { ManifestState } from '@travetto/manifest';

import { log, spawn, compileIfStale, getProjectSources, addNodePath, importManifest } from './utils';

let manifestTemp;

type CompileConfig = {
  compile?: boolean;
  compilerFolder: string;
  outputFolder: string;
  watch?: boolean;
};

/**
 *  Step 1
 */
async function buildManifest(config: CompileConfig): Promise<ManifestState> {
  await compileIfStale(
    '[1] Manifest Bootstrapping',
    await getProjectSources('@travetto/manifest', config.compilerFolder),
  );

  log('[1] Manifest Generation');
  const { ManifestUtil } = await importManifest(config.compilerFolder);
  const state = await ManifestUtil.produceState(process.cwd(), config.outputFolder);
  state.manifest.buildLocation = config.compilerFolder;
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
async function buildCompiler(state: ManifestState, config: CompileConfig): Promise<void> {
  await compileIfStale(
    '[2] Compiler Bootstrapping',
    await getProjectSources('@travetto/compiler', config.compilerFolder),
  );

  await compileIfStale(
    '[2] Compiler Bootstrapping',
    await getProjectSources('@travetto/transformer', config.compilerFolder),
  );

  const changed = shouldRebuildCompiler(state);

  if (changed.transformers.length) {
    log('[2] Clearing output: */support/transform changed');
    // Delete all output on transformer changes
    await fs.rm(config.outputFolder, { recursive: true, force: true }).catch(() => { });
    state = await buildManifest(config);
    let x = 0;
    for (const [mod, file] of changed.transformers) {
      await compileIfStale(
        `[2.${x += 1}] ${file} Bootstrapping`,
        await getProjectSources(mod, config.compilerFolder, ['package.json', file])
      );
    }
  }

  log('[2] Compiler Ready');
}

/**
 *  Step 4
 */
async function compileOutput(state: ManifestState, { compilerFolder, outputFolder, watch = false }: CompileConfig): Promise<void> {
  const changes = Object.values(state.delta).flat();
  if (changes.length === 0 && !(watch)) {
    log('[3] Output Ready');
    return;
  }

  log('[3] Changed Sources', changes);
  const { ManifestUtil } = await importManifest(compilerFolder);
  const args = [
    `${compilerFolder}/${state.manifest.modules['@travetto/compiler'].output}/support/main.output`,
    (manifestTemp ??= await ManifestUtil.writeState(state)),
    outputFolder
  ];
  await spawn('[3] Compiling', process.argv0, {
    args, env: { TRV_WATCH: `${watch}` },
    cwd: compilerFolder,
    showWaitingMessage: !(watch)
  });
}

export async function compile(config: CompileConfig): Promise<void> {

  // Skip compilation if not installed
  if (config.compile !== false) {
    const state = await buildManifest(config); // Step 1
    await buildCompiler(state, config); // Step 2
    await compileOutput(state, config); // Step 3
  }

  // Only  manipulate if we aren't in the output folder
  if (config.outputFolder !== process.cwd()) {
    addNodePath(config.outputFolder);
  }

  // Share back so ModuleIndex will pick it up
  process.env.TRV_OUTPUT = config.outputFolder;
}