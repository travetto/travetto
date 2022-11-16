#!/usr/bin/env node
// @ts-check

const { resolve } = require('path');
const { log, spawn, compileModuleIfStale, addNodePath } = require('./utils');

let manifestTemp;

/**
 @typedef {{
   compilerFolder: string;
   outputFolder: string;
   watch?: boolean;
 }} BuildConfig

 @typedef {BuildConfig & {
    main?: string;
    compile?: boolean;
 }} BootConfig

 @typedef {import('@travetto/manifest').ManifestState} ManifestState
*/

/**
 * @param {string} compilerFolder
 */
const importManifest = (compilerFolder) => require(resolve(compilerFolder, 'node_modules', '@travetto/manifest'));

/**
 *  Step 1
 *
 * @param {BuildConfig} config
 * @return {Promise<ManifestState>}
 */
async function buildManifest(config) {
  await compileModuleIfStale(config.compilerFolder, '@travetto/manifest', '[1] Manifest Bootstrapping');

  log('[1] Manifest Generation');
  const { ManifestUtil } = importManifest(config.compilerFolder);
  const state = await ManifestUtil.produceState(process.cwd(), config.outputFolder);
  state.manifest.buildLocation = config.compilerFolder;
  return state;
}

/**
 * @param {ManifestState} param0
 * @returns {boolean}
 */
function shouldRebuildCompiler({ delta }) {
  // Did enough things change to re-stage and build the compiler
  const transformersChanged = Object.values(delta).flatMap(x => x.filter(y => y[0].startsWith('support/transform')));
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
  return changed > 0;
}

/**
 *  Step 2
 * @param {ManifestState} state
 * @param {BuildConfig} config
 * @return {Promise<void>}
 */
async function buildCompiler(state, config) {

  await compileModuleIfStale(config.compilerFolder, '@travetto/compiler', '[2] Compiler Bootstrapping');

  if (shouldRebuildCompiler(state)) {
    const { ManifestUtil } = importManifest(config.compilerFolder);
    const args = [
      `${config.compilerFolder}/${state.manifest.modules['@travetto/compiler'].output}/support/main.setup`,
      (manifestTemp ??= await ManifestUtil.writeState(state)),
      config.compilerFolder
    ];
    await spawn('[2] Compiler Instantiating', process.argv0, { args, cwd: process.cwd() }); // Step 3.b
  }

  log('[2] Compiler Ready');
}

/**
 *  Step 4
 * @param {ManifestState} state
 * @param {BuildConfig} config
 * @return {Promise<void>}
 */
async function compileOutput(state, config) {
  const changes = Object.values(state.delta).flat();
  if (changes.length === 0 && !(config.watch ?? false)) {
    log('[3] Output Ready');
    return;
  }

  log('[3] Changed Sources', changes);
  const { ManifestUtil } = importManifest(config.compilerFolder);
  const args = [
    `${config.compilerFolder}/${state.manifest.modules['@travetto/compiler'].output}/support/main.output`,
    (manifestTemp ??= await ManifestUtil.writeState(state)),
    config.outputFolder
  ];
  await spawn('[3] Compiling', process.argv0, {
    args, env: { TRV_WATCH: `${config.watch ?? false}` },
    cwd: config.compilerFolder,
    showWaitingMessage: !(config.watch ?? false)
  });
}

/**
 * @param {BootConfig} config
 */
async function boot(config) {
  let compilerTsConfig = undefined;

  // Skip compilation if not installed
  if (config.compile || config.watch) {
    try {
      compilerTsConfig = require.resolve('@travetto/compiler/tsconfig.precompile.json');
    } catch { }

    if (compilerTsConfig) {
      const state = await buildManifest(config); // Step 1
      await buildCompiler(state, config); // Step 2
      await compileOutput(state, config); // Step 3
    }
  }

  // Only  manipulate if we aren't in the output folder
  if (config.outputFolder !== process.cwd()) {
    addNodePath(config.outputFolder);
  }

  // Share back so ModuleIndex will pick it up
  process.env.TRV_OUTPUT = config.outputFolder;

  const { finalize, invokeMain } = require('@travetto/boot/support/init');

  if (config.main) {
    const { main: entryPoint } = require(config.main);
    return invokeMain(entryPoint);
  } else {
    return finalize();
  }
}

module.exports = { boot };