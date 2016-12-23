let {Ready} = require('@encore/lifecycle');

require('@encore/bootstrap').init({
  defaultEnv: 'local',
  scan: 'src/app/route/**/*.ts',
  preInit: () => {
    Ready.onReady(() => Configure.log());
  }
});