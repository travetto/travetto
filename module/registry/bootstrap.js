require('@encore2/config/bootstrap');
require('@encore2/compiler/bootstrap');

let { Registry } = require('./src/service/registry');

function init() {
  return Registry.initialize();
}

module.exports = { init };
