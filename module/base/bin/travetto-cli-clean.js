//@ts-check

function clean() {
  require('../src/cache').AppCache.clear();
}

// Allow for direct invocation
if (require.main === module) {
  clean();
} else {
  // @ts-ignore
  const { Util: { program } } = require('@travetto/cli/src/util');

  module.exports = () => {
    program.command('clean').action(clean);
  };
}