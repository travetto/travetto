#!/usr/bin/env node

process.env.ENV = 'test';

const startup = require('@travetto/base/bootstrap');

if (process.env.EXECUTOR) {
  process.env.NO_WATCH = true;
  require('../src/exec/executor').server();
} else {
  startup.run().then(x => {
    const { Runner } = require('../src/exec/runner');
    new Runner(process.argv).run().then(x => process.exit(0), e => process.exit(1));
  });
}