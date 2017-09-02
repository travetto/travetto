require('@encore/config/bootstrap');
require('@encore/compiler/bootstrap');

let { DependencyRegistry } = require('./src/service/registry');
let { externalPromise } = require('@encore/util');

let _waitingForInit = false;
let initialized = externalPromise();

async function init() {
  if (!_waitingForInit) {
    _waitingForInit = true;
    await DependencyRegistry.initialize();
    initialized.resolve(true);
  }
  return await initialized;
}

module.exports = { init };