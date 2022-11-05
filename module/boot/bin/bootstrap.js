#!/usr/bin/env node

// @ts-check
const path = require('path');

const { log, spawn, isFolderStale, resolveImport } = require('./build-support');

/**
 *  Step 1
 */
async function bootstrap() {
  const folder = path.resolve(__dirname, '../support/bin');
  if (await isFolderStale(folder)) {
    log('[1] Bootstrap Rebuilding.');
    const TSC = `${resolveImport('typescript', true)}/bin/tsc`;
    await spawn('Compiling Bootstrap', TSC, { cwd: folder });
  } else {
    log('[1] Bootstrap Rebuild Skipped.');
  }
};

/**
 * @param {Partial<import('./build-support').BuildConfig & { compile?: boolean }>} cfg 
 */
async function boot({
  compilerFolder = path.resolve('.trv_compiler'),
  outputFolder = path.resolve('.trv_out'),
  watch,
  compile = process.env.TRV_COMPILED !== '1'
} = {}) {
  if (compile) {
    await bootstrap(); // Step 1 
    await require('../support/bin/build').build({
      compilerFolder, outputFolder, watch
    });
  }

  process.env.TRV_MANIFEST_ROOT = outputFolder;
  process.env.NODE_PATH = [`${outputFolder}/node_modules`, process.env.NODE_PATH].join(path.delimiter);
  // @ts-expect-error
  require('module').Module._initPaths();
}

module.exports = { boot };