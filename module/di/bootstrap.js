require('@encore/config/bootstrap');

let { DependencyRegistry } = require('@encore/di');
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