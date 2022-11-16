#!/usr/bin/env node
// @ts-check

const { readFileSync, writeFileSync } = require('fs');
const { delimiter } = require('path');
const { log, spawn, compileProjectIfStale } = require('./utils');

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

const bootstrapManifest = async () => {
  await compileProjectIfStale(
    '@travetto/manifest/tsconfig.precompile.json',
    {
      go: '[0] Manifest Bootstrapping',
      skip: '[0] Manifest Bootstrapping Skipped.',
      build: '[0] Bootstrapping Manifest'
    }
  );
  const json = require.resolve('@travetto/manifest/package.json');
  writeFileSync(json, readFileSync(json, 'utf8').replace(/"index[.]ts"/g, `"index.js"`));
};

/**
 *  Step 1
 *
 * @param {BuildConfig} cfg
 * @return {Promise<ManifestState>}
 */
async function buildManifest(cfg) {
  log('[1] Generating Manifest state');
  const { ManifestUtil } = require('@travetto/manifest');
  const state = await ManifestUtil.produceState(process.cwd(), cfg.outputFolder);
  state.manifest.buildLocation = cfg.compilerFolder;
  return state;
}

/**
 * Step 2
 */
const bootstrapCompiler = () => compileProjectIfStale(
  '@travetto/compiler/tsconfig.precompile.json',
  {
    go: '[2] Compiler Bootstrap',
    skip: '[2] Compiler Bootstrap Skipped.',
    build: '[2] Compiler Bootstrapping'
  }
);

/**
 * @param {ManifestState} param0
 * @returns {boolean}
 */
function shouldRebuildCompiler({ delta }) {
  // Did enough things change to re-stage and build the compiler
  const transformersChanged = Object.values(delta).flatMap(x => x.filter(y => y[0].startsWith('support/transform')));
  const transformerChanged = (delta['@travetto/transformer'] ?? []);
  const compilerChanged = Object.values(delta['@travetto/compiler'] ?? []);

  const changed = transformerChanged.length || transformersChanged.length || compilerChanged.length;
  if (changed) {
    if (compilerChanged.length) {
      log('[3] Changed @travetto/compiler', compilerChanged);
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
 * @param {ManifestState} state
 * @param {string} compilerFolder
 * @return {Promise<void>}
 */
async function compilerSetup(state, compilerFolder) {
  if (shouldRebuildCompiler(state)) {
    log('[3] Setting up Compiler');
    const { ManifestUtil } = require('@travetto/manifest');
    const args = [
      `${state.manifest.modules['@travetto/compiler'].source}/support/main.setup`,
      (manifestTemp ??= await ManifestUtil.writeState(state)),
      compilerFolder
    ];
    await spawn('Setting up Compiler', process.argv0, { args, cwd: process.cwd() }); // Step 3.b
  } else {
    log('[3] Skipping Compiler Setup');
  }
}

/**
 *  Step 4
 * @param {ManifestState} state
 * @param {BuildConfig} config
 * @return {Promise<void>}
 */
async function compileOutput(state, { compilerFolder, outputFolder, watch = false }) {
  const changes = Object.values(state.delta).flat();
  if (changes.length === 0 && !watch) {
    log('[4] Skipping Compilation');
    return;
  }

  log('[4] Recompiling Sources', changes);
  const { ManifestUtil } = require('@travetto/manifest');
  const args = [
    `${compilerFolder}/${state.manifest.modules['@travetto/compiler'].output}/support/main.output`,
    (manifestTemp ??= await ManifestUtil.writeState(state)),
    outputFolder
  ];
  await spawn('Compiling Output', process.argv0, { args, env: { TRV_WATCH: `${watch}` }, cwd: compilerFolder, showWaitingMessage: !watch });
}

/**
 * @param {BootConfig} cfg
 */
async function boot({ outputFolder, compilerFolder, compile, main, watch }) {
  let compilerTsConfig = undefined;

  // Skip compilation if not installed
  if (compile || watch) {
    try {
      compilerTsConfig = require.resolve('@travetto/compiler/tsconfig.precompile.json');
    } catch { }

    if (compilerTsConfig) {
      const cfg = { compilerFolder, outputFolder, watch };
      await bootstrapManifest(); // Step 0
      const state = await buildManifest(cfg); // Step 1
      await bootstrapCompiler(); // Step 2
      await compilerSetup(state, cfg.compilerFolder); // Step 3
      await compileOutput(state, cfg); // Step 4
    }
  }

  // Only  manipulate if we aren't in the output folder
  if (outputFolder !== process.cwd()) {
    process.env.NODE_PATH = [`${outputFolder}/node_modules`, process.env.NODE_PATH].join(delimiter);
    // @ts-expect-error
    require('module').Module._initPaths();
  }

  // Share back so ModuleIndex will pick it up
  process.env.TRV_OUTPUT = outputFolder;

  const { finalize, invokeMain } = require('@travetto/boot/support/init');

  if (main) {
    const { main: entryPoint } = require(main);
    return invokeMain(entryPoint);
  } else {
    return finalize();
  }
}

module.exports = { boot };