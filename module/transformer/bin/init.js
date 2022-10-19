const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const folder = path.resolve(__dirname, '..', 'support', 'bin');
if (process.env.TRV_DEV && !fs.existsSync(path.resolve(folder, 'setup.js'))) {
  const tsc = require.resolve('typescript').replace(/\/lib.*$/, '/bin/tsc');
  const args = [
    '--outDir', folder,
    '-t', 'es2021',
    '-m', 'commonjs',
    '--rootDir', folder,
    '--strict',
    '--skipLibCheck',
    './config.ts', './manifest.ts', './setup.ts'
  ];
  cp.spawnSync(tsc, args, { cwd: folder });
}
module.exports = require('../support/bin/setup');