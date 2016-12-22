require('@encore/bootstrap');

function init(env, imports = null) {
  require('./src/lib').Configure.initialize(env || 'local');
  if (imports) {
    require('@encore/util').bulkRequire(imports);
  }
}
const registerNamespace = require('./src/lib').Configure.registerNamespace;

if (!!process.env.auto) {
  init(process.env.env);
} else {
  module.exports = { init, registerNamespace }
}