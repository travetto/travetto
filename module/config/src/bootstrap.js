require('./core/util/require-ts');
function init(env, imports = null) {
  require('./core/init/configure').configure(env);
  if (imports) {
    require('./core/util').bulkRequire(imports);
  }
}
const registerNamespace = require('./core/init/configure').registerNamespace;

module.exports = { init, registerNamespace }