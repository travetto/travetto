#!/usr/bin/env node

process.env.ENV = 'test';
require('@travetto/base/bootstrap');
const { Runner } = require('../src/exec/runner');
new Runner(process.argv).run().then(() =>
  process.exit(0)
).catch(e => {
  console.log(e);
  process.exit(1);
})