function init(name, handlerFn) {
  require('@encore/base/src/lib/require-ts');
  require('./src/lib/mocha').registerTest(name, handlerFn());
}
module.exports = { init };