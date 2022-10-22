const path = require('path');
const fs = require('fs');

const FOLDER = path.resolve(__dirname, '..', 'support', 'bin');
const FILES = ['./precompile.ts', './config.ts', './workspace.ts', './manifest.ts'];

/**
 * @param {fs.Stats} stat 
 */
const recent = stat => Math.max(stat.ctimeMs, stat.mtimeMs);

function shouldBootstrapCompiler(folder, files) {
  for (const f of files) {
    const source = path.resolve(folder, f);
    try {
      const targetStat = fs.statSync(source.replace(/[.]ts$/, '.js'));
      const sourceStat = fs.statSync(source);
      if (recent(sourceStat) > recent(targetStat)) {
        return true;
      }
    } catch {
      return true;
    }
  }
  return false;
}

function shouldStageCompiler() {

}


function bootstrapCompiler(folder, files) {
  const cmd = require.resolve('typescript').replace(/(node_modules\/typescript)\/.*$/, (_, s) => `${s}/bin/tsc`);
  const args = [
    '--outDir', folder,
    '-t', 'es2021',
    '-m', 'commonjs',
    '--rootDir', folder,
    '--strict',
    '--skipLibCheck',
    ...files
  ];
  require('child_process').spawnSync(cmd, args, { cwd: folder });
}


function init() {
  if (shouldBootstrapCompiler(FOLDER, FILES)) {
    bootstrapCompiler(FOLDER, FILES);
  }

  const { COMPILER_OUTPUT, SOURCE_OUTPUT } = require('../support/bin/config');

  if (!fs.existsSync(COMPILER_OUTPUT)) {
    cp.spawnSync(process.argv0, [require.resolve('../support/bin/precompile')], { stdio: ['pipe', 'pipe', 2], env: process.env });
  }

  // Maybe?
  const { writeManifest, buildManifest } = require('../support/bin/manifest');
  writeManifest(COMPILER_OUTPUT, buildManifest());

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