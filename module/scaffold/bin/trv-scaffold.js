#!/usr/bin/env node
// @ts-check

async function getScaffoldDirectory() {
  if (process.env.npm_lifecycle_script?.includes('trv-scaffold')) { // Is npx  run
    const { delimiter } = await import('node:path');
    const parts = process.env.PATH?.split(delimiter) ?? [];
    const loc = parts.find(part => part.includes('npx') && part.includes('.bin'));
    if (loc) {
      return loc.split('/node_modules')[0];
    }
  }
  return process.cwd();
}

/**
 * @param {string} cwd
 */
async function getVersion(cwd) {
  const fs = await import('node:fs/promises');
  const pkg = JSON.parse(await fs.readFile(`${cwd}/package.json`, 'utf8'));
  const version = `${pkg.dependencies['@travetto/scaffold']}`.replace(/\d+$/, '0');
  return version;
}

(async function () {
  const scaffoldDirectory = await getScaffoldDirectory();
  const version = await getVersion(scaffoldDirectory);

  const { spawn, execSync } = await import('node:child_process');
  // Ensure we install the compiler first
  execSync(`npm i @travetto/compiler@${version}`, { stdio: 'pipe', cwd: scaffoldDirectory });

  spawn('npx', [
    'trvc', 'exec',
    '@travetto/cli/support/entry.trv.js',
    'scaffold',
    '-c', process.cwd(),
    ...process.argv.slice(2)
  ], {
    stdio: 'inherit',
    cwd: scaffoldDirectory,
    env: {
      ...process.env,
      TRV_QUIET: '1',
    }
  });
})();