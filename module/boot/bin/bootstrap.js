#!/usr/bin/env node

// @ts-check
const path = require('path');
const fs = require('fs/promises');

const { log, spawn } = require('./build-support');

const recent = stat => Math.max(stat.ctimeMs, stat.mtimeMs);

async function isSourceStale(source) {
  try {
    if (recent(await fs.stat(source)) <= recent(await fs.stat(source.replace(/[.]ts$/, '.js')))) {
      return false;
    }
  } catch { }
  return true;
}

async function shouldBootstrap(location) {
  const files = await fs.readdir(location);
  const flags = await Promise.all(
    files
      .filter(x => !x.startsWith('.'))
      .map(x => path.resolve(location, x))
      .map(isSourceStale)
  );
  return flags.some(x => x === true);
}

/**
 *  Step 1
 */
async function bootstrap() {
  const folder = path.resolve(__dirname, '../support/bin');
  if (await shouldBootstrap(folder)) {
    log('[1] Bootstrap Rebuilding.');
    const TSC = require.resolve('typescript').replace(/(node_modules\/typescript)\/.*$/, (_, s) => `${s}/bin/tsc`);
    await spawn('Compiling Bootstrap', TSC, [], folder, false);
  } else {
    log('[1] Bootstrap Rebuild Skipped.');
  }
};

async function build(outputFolder, compilerFolder) {
  await bootstrap(); // Step 1 
  const { build } = require('../support/bin/build');
  await build(outputFolder, compilerFolder);
}

function run(outputFolder) {
  process.chdir(outputFolder);
  process.env.NODE_PATH = [`${outputFolder}/node_modules`, process.env.NODE_PATH].join(path.delimiter);
  // @ts-expect-error
  require("module").Module._initPaths();
}

async function init(
  outputFolder = path.resolve('.trv_out'),
  compilerFolder = path.resolve('.trv_compiler')
) {
  if (process.env.TRV_COMPILE !== '0') {
    await build(outputFolder, compilerFolder)
  }
  run(outputFolder);
}

module.exports = { init };

if (require.main === module) {
  init();
}