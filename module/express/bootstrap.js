
require('@encore/bootstrap').init({
  defaultEnv: 'local',
  scan: 'src/app/route/**/*.ts',
  preInit: () => {
    require('@encore/lifecycle').Ready.onReady(() => Configure.log());
  }
});