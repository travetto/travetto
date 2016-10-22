function init(name, handler) {
  require('@encore/base/src/lib/require-ts');
  require('./mocha').registerTest(name, handler);
}
module.exports = { init };