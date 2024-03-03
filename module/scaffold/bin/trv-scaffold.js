#!/usr/bin/env node

async function getScaffoldCwd() {
  let cwd = process.cwd();
  if (process.env.npm_lifecycle_script === 'trv-scaffold') { // Is npx  run
    const { delimiter } = await import('node:path');
    const parts = process.env.PATH.split(delimiter);
    const loc = parts.find(p => p.includes('npx') && p.includes('.bin'));
    if (loc) {
      cwd = loc.split('/node_modules')[0];
    }
  }
  return cwd;
}

async function getVersion(cwd) {
  const fs = await import('node:fs/promises');
  const pkg = JSON.parse(await fs.readFile(`${cwd}/package.json`, 'utf8'));
  const version = pkg.version.replace(/(\d+[.]\d+)[.]\d+/, (_, v) => `${v}.0`).replace(/-([a-z]+)[.]\d+$/, (_, v) => `${v}.0`);
  return version;
}

(async function () {
  const scaffoldCwd = await getScaffoldCwd();
  const version = await getVersion(scaffoldCwd);

  const { spawn } = await import('node:child_process');
  spawn('npx', [
    `--package=@travetto/compiler@~${version}`,
    '--',
    'trvc', 'exec',
    '@travetto/cli/support/entry.trv.js',
    'scaffold',
    '-c', process.cwd(),
    ...process.argv.slice(2)
  ], {
    stdio: 'inherit',
    cwd: scaffoldCwd,
    env: {
      ...process.env,
      TRV_QUIET: 1,
      NPM_CONFIG_YES: 'true'
    }
  });
})();