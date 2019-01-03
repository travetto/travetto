//@ts-check

process.env.ENV = 'test';
process.env.TRV_CACHE_DIR = 'PID';

require('@travetto/base/bin/bootstrap');
require('../src/runner/communication').server();