#!/usr/bin/env node

// @ts-check
const { path } = require('@travetto/common');

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
 * @param {Partial<import('./build-support').BuildConfig & { main?: string, compile?: boolean }>} cfg 
 */
async function boot({ main, compilerFolder, outputFolder, compile, watch } = {}) {

  try { require(path.resolve('.env')) } catch { }

  compilerFolder ??= process.env.TRV_COMPILER ?? path.resolve('.trv_compiler');
  outputFolder ??= process.env.TRV_OUTPUT ?? path.resolve('.trv_out');
  compile ??= process.env.TRV_COMPILED !== '1';

  // Share back
  process.env.TRV_OUTPUT = outputFolder;

  if (compile) {
    await bootstrap(); // Step 1 
    await require('../support/bin/build').build({
      compilerFolder, outputFolder, watch
    });
  }

  // Only  manipulate if we aren't in the output folder
  if (outputFolder !== process.cwd()) {
    process.env.NODE_PATH = [`${outputFolder}/node_modules`, process.env.NODE_PATH].join(path.delimiter);
    // @ts-expect-error
    require('module').Module._initPaths();
  }
  if (main) {
    require('@travetto/boot/support/init');
    ᚕtrv.main(require(main).main);
  }
}

module.exports = { boot };