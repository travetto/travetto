require('@encore2/config/bootstrap');
require('@encore2/compiler/bootstrap');

module.exports = require('./src/service/root').RootRegistry;

if (require.resolve(process.argv[1]) === __filename) {
  module.exports.init();
}