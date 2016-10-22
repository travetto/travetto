function init(handlerFn) {
  require('@encore/base/src/lib/require-ts');
  require('./src/lib/suite').registerTest(handlerFn());
}
module.exports = { init };