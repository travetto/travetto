//@ts-check
const fs = require('fs');

async function getApps() {
  process.env.QUIET_INIT = 'true';
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
  ScanApp.requireFiles('.ts', x =>
    /^(src|e2e)\/.*[^.][^d][.]ts$/.test(x) &&
    fs.readFileSync(x).toString().includes('@Application')); // Only load files that are candidates

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