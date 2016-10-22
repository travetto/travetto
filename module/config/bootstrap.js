require('@encore/base/src/lib/require-ts');

function init(env = null, imports = null) {
  env = env || process.env.env || 'local';
  require('./src/lib').configure(env);
  if (imports) {
    require('@encore/base').bulkRequire(imports);
  }
}
const registerNamespace = require('./src/lib').registerNamespace;

module.exports = { init, registerNamespace }