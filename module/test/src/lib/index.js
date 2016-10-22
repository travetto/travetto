function init(ready?:Function) {
  require('@encore/init/bootstrap').init('test');
  if (ready) {
    ready();
  }
  require('./mocha-ui');
}
module.exports =  { init };
