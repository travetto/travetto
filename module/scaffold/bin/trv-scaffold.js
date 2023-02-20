#!/usr/bin/env node

(async function () {
  const args = [...process.argv.slice(0, 2), 'scaffold', ...process.argv.slice(2)];
  if (process.env.npm_lifecycle_script === 'trv-scaffold') { // Is npx  run
    const path = await import('path');
    const parts = process.env.PATH.split(path.delimiter);
    const loc = parts.find(p => p.includes('npx') && p.includes('.bin'));
    if (loc) {
      const final = loc.split('/node_modules')[0];
      args.push('-c', process.cwd());
      process.chdir(final);
    }
  }
  process.argv = args;
  await import('@travetto/compiler/bin/trv.js');
})();