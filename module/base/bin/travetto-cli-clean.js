function clean() {
  require('../src/cache').AppCache.clear();
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