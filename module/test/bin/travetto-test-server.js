//@ts-check

process.env.ENV = 'test';

require('@travetto/base/bin/bootstrap');
require('../src/runner/communication').server();