require('@encore/base/src/lib/require-ts');

function init(env, imports = null) {
  require('./src/lib').configure(env || 'local');
  if (imports) {
    require('@encore/base').bulkRequire(imports);
  }
}
const registerNamespace = require('./src/lib').registerNamespace;

if (!!process.env.auto) {
  init(env = env || process.env.env);
} else {
  module.exports = { init, registerNamespace }
}