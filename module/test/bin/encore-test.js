#!/usr/bin/env node

process.env.ENV = 'test';
require('@encore2/base/bootstrap');
const { Runner } = require('../src/exec/runner');
try {
  new Runner(process.argv).run();
  process.exit(0);
} catch (e) {
  process.exit(1);
}