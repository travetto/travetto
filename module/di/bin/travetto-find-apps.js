//@ts-check
async function getApps() {
  process.env.QUIET_CONFIG = 'true';
  process.env.DEBUG = 'false';

  // Suppress all output
  const og = console.log;
  console.warn = console.debug = console.log = function () { };

  await require('@travetto/base/bin/bootstrap'); // Load base transpiler

  //Initialize upto compiler
  const { PhaseManager } = require('@travetto/base/src/phase');
  const mgr = new PhaseManager('bootstrap');
  mgr.load('compiler');
  await mgr.run();

  //Load app files
  const { ScanApp } = require('@travetto/base/src/scan-app');
  ScanApp.requireFiles('.ts', x => !x.endsWith('.d.ts') && x.startsWith('src') || x.startsWith('e2e'));

  //Get applications
  const res = require('../src/registry').DependencyRegistry.getApplications();

  og.call(console, JSON.stringify(res.map(x => ({
    watchable: x.watchable,
    description: x.description,
    name: x.name,
    filename: x.target.__filename,
    id: x.target.__id
  }))));
}

getApps();