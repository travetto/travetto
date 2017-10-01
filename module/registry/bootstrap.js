require('@travetto/config/bootstrap');
require('@travetto/compiler/bootstrap');

module.exports = require('./src/service/root').RootRegistry;

if (require.resolve(process.argv[1]) === __filename) {
  module.exports.init();
}