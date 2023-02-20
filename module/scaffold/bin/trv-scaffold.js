#!/usr/bin/env node
(async function () {
  process.argv = [...process.argv.slice(0, 2), 'scaffold', ...process.argv.slice(2)];
  if (__filename.includes('npx')) {
    process.env.TRV_CLI_CWD = __filename.split('/node_modules')[0];
  }
  await import('@travetto/compiler/bin/trv.js');
})();