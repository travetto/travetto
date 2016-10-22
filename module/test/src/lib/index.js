function init(name, handler) {
  require('@encore/init/bootstrap').init('test');
  require('./mocha').registerTest(name, handler);
}
module.exports = { init };