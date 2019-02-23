Object.assign(
  process.env,
  {
    QUIET_INIT: '1',
    DEBUG: process.env.DEBUG || '0',
    PROD: '0',
    TRV_CACHE_DIR: 'TRV_CACHE_DIR' in process.env ? process.env.TRV_CACHE_DIR : '-',
    APP_ROOT: '0',
    WATCH: '0',
    PROFILE: 'test',
    RESOURCE_PATHS: 'test'
  }
);

module.exports = {};