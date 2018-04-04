#!/usr/bin/env node

process.env.ENV = 'test';

const startup = require('@travetto/base/bootstrap');

if (process.env.EXECUTION) {
  process.env.NO_WATCH = true;
  require('../src/exec/communication').server();
} else {
  startup.run().then(x => {
    const { Runner } = require('../src/exec/runner');
    new Runner(process.argv).run().then(x => process.exit(0), e => process.exit(1));
  });
}