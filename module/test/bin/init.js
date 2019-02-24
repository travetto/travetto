const extra = {
  QUIET_INIT: '1',
  DEBUG: process.env.DEBUG || '0',
  PROD: '0',
  TRV_CACHE_DIR: 'TRV_CACHE_DIR' in process.env ? process.env.TRV_CACHE_DIR : '-',
  TRV_TEST_BASE: process.env.TRV_TEST_BASE || require('path').resolve(__dirname, '..'),
  APP_ROOT: '0',
  WATCH: '0',
  PROFILE: 'test',
  RESOURCE_PATHS: 'test'
};
Object.assign(process.env, extra);

module.exports = extra;