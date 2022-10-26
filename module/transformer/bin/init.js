const path = require('path');
const fs = require('fs');

const { relativeDelta, bootstrap } = require('../../manifest/bin/manifest');

const FOLDER = path.resolve(__dirname, '..', 'support', 'bin');
const FILES = ['./precompile.ts', './config.ts', './workspace.ts', './manifest.ts'];

function shouldBootstrapCompiler(delta) {
  return !!(delta['@travetto/transformer'] ?? []).find(x => x.startsWith('support/bin/'));
}

function init() {
  const CWD = process.cwd().replace(/[\\]/g, '/');
  const COMPILER_OUTPUT = path.resolve(CWD, process.env.TRV_COMPILER ?? '.trv_compiler');
  const delta = relativeDelta(COMPILER_OUTPUT);

  if (shouldBootstrapCompiler(delta)) {
    bootstrap(FOLDER, FILES);
  }

  const { COMPILER_OUTPUT, SOURCE_OUTPUT } = require('../support/bin/config');

  // Look at delta to determine if we need to run pre-compile

  if (!fs.existsSync(COMPILER_OUTPUT)) {
    cp.spawnSync(process.argv0, [require.resolve('../support/bin/precompile')], { stdio: ['pipe', 'pipe', 2], env: process.env });
  }

  // Maybe?
  const { writeManifest, buildManifest } = require('../support/bin/manifest');
  writeManifest(COMPILER_OUTPUT, buildManifest());

  // Look at delta to determine if we need to run compile

  // Compile
  cp.spawnSync(process.argv0, [
    `${COMPILER_OUTPUT}/node_modules/@travetto/transformer/support/main.compiler`,
    SOURCE_OUTPUT,
  ], { stdio: ['pipe', 'pipe', 2], env: process.env });


  if (!process.env.TRV_CACHE) {
    if (fs.existsSync(SOURCE_OUTPUT)) {
      process.env.TRV_CACHE = SOURCE_OUTPUT;
    } else if (fs.existsSync(COMPILER_OUTPUT)) {
      process.env.TRV_CACHE = COMPILER_OUTPUT;
    }
  }
}


module.exports = { init };