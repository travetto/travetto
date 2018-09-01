function clean() {
  require('../src/cache').AppCache.clear();
}

// Allow for direct invocation
if (require.main === module) {
  clean();
} else {
  const { Util: { program } } = require('@travetto/cli/src/util');

  module.exports = () => {
    program.command('clean').action(clean);
  };
}