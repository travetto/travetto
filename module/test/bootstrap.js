#!/usr/bin/env node

process.env.ENV = 'test';
require('@encore2/base/bootstrap');

if (process.send) {
  const {
    Compiler
  } = require('@encore2/compiler');
  Compiler.workingSets = process.argv.slice(2);
  Compiler.init(process.cwd());
}

new require('./src/runner').Runner()