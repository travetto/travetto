require('@encore2/config/bootstrap');
require('@encore2/compiler/bootstrap');

let { DependencyRegistry } = require('./src/service/registry');

function init() {
  return DependencyRegistry.initialize();
}

module.exports = { init };
