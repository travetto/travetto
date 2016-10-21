require('@encore/base/src/lib/require-ts');

function init(env, imports = null) {
  require('./src/lib').configure(env);
  if (imports) {
    require('@encore/base').bulkRequire(imports);
  }
}
const registerNamespace = require('./src/lib').registerNamespace;

module.exports = { init, registerNamespace }