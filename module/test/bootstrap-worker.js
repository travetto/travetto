#!/usr/bin/env node

const { agent } = require('./src/service/agent/agent-wrapper.js');

process.env.ENV = 'test';
process.env.NO_WATCH = true;
let Compiler;

agent((done) => {
  console.log('Init');
  require('@encore2/base/bootstrap');
  Compiler = require('@encore2/compiler').Compiler;
  Compiler.workingSets = ['!'];
  Compiler.init(process.cwd());
  done();
}, (data, done) => {
  console.log('Run');
  Compiler.workingSets = [data.file];
  Compiler.resetFiles();
  const { Runner } = require('./src/runner');
  new Runner().runWorker(data, done);
});