#!/usr/bin/node
const path = require('path');
const cp = require('child_process');

/**
 * Find which package a command lives in
 * @param {string} cmd
 * @returns
 */
function findPackage(toFind) {
  let dir = process.cwd();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const old = dir;
    dir = path.dirname(dir);
    if (old === dir) {
      return;
    }
    try {
      require.resolve(`${dir}/package.json`);
      const pkg = require(`${dir}/package.json`);
      if (pkg.scripts && (!toFind || pkg.scripts[toFind])) {
        return dir;
      }
    } catch { }
  }
}

const [cmd = '', ...args] = process.argv.slice(2).map(x => x === '.' ? process.cwd() : x);
const cwd = findPackage(cmd) ?? process.cwd();

try {
  cp.execSync(
    `npm run ${cmd} ${args.join(' ')}`.trim(),
    { stdio: [0, 1, 2], cwd, env: process.env, encoding: 'utf8' }
  );
} catch {
  process.exit(1);
}
