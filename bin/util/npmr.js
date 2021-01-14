#!/usr/bin/node
const path = require('path');
const cp = require('child_process');

function findPackage(cmd) {
  let dir = process.cwd();
  while (true) {
    let old = dir;
    dir = path.dirname(dir);
    if (old === dir) {
      return;
    }
    try {
      require.resolve(`${dir}/package.json`);
      const pkg = require(`${dir}/package.json`);
      if (pkg.scripts && (!cmd || pkg.scripts[cmd])) {
        return dir;
      }
    } catch { }
  }
}

const [cmd = '', ...args] = process.argv.slice(2).map(x => x == '.' ? process.cwd() : x);
const cwd = findPackage(cmd) ?? process.cwd();

try {
  cp.execSync(
    `npm run ${cmd} ${args.join(' ')}`.trim(),
    { stdio: [0, 1, 2], cwd, env: process.env, encoding: 'utf8' }
  );
} catch {
  process.exit(1);
}
