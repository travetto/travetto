//@ts-check

process.env.ENV = 'test';
process.env.NO_WATCH = 'true';

require('@travetto/base/bin/bootstrap');
require('../src/runner/communication').server();