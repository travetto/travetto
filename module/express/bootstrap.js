
require('@encore/bootstrap').init({
  defaultEnv: 'local',
  scan: 'src/app/route/**/*.ts',
  preInit: () => {
    let {Ready} = require('@encore/lifecycle');
    let {Configure} = require('@encore/config');
    Ready.onReady(() => Configure.log());
  }
});