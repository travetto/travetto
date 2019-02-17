Object.assign(process.env, {
  APP_ROOT: '0',
  QUIET_INIT: '1',
  DEBUG: process.env.DEBUG || '0',
  PROD: '0',
  WATCH: '0',
  TRV_CACHE_DIR: 'PID',
  PROFILE: 'test',
  RESOURCE_PATHS: 'test'
});

module.exports = {};