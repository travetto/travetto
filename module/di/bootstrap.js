require('@encore/config/bootstrap');
require('@encore/compiler/bootstrap');

let { DependencyRegistry } = require('./src/service/registry');

function init() {
  return DependencyRegistry.initialize();
}

module.exports = { init };