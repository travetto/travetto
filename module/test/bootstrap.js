function init(handlerFn) {
  require('@encore/base/src/lib/require-ts');
  require('./src/lib/mocha').registerTest(handlerFn());
}
module.exports = { init };