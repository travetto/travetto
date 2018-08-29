function clean() {
  const { Env: { cwd } } = require('../src/env');
  const { Cache } = require('../src/cache');
  new Cache(cwd).clear();
}

module.exports = function init(program) {
  return program
    .command('clean')
    .action(clean);
};

// Allow for direct invocation
if (require.main === module) {
  clean();
}