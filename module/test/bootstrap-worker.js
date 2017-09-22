#!/usr/bin/env node

const { agent } = require('./src/service/agent/agent-wrapper.js');

process.env.ENV = 'test';
process.env.NO_WATCH = true;
let Compiler;

agent((done) => {
  Compiler = require('@encore2/compiler').Compiler;
  Compiler.workingSets = ['!'];
  Compiler.init(process.cwd());
  done();
}, (done) => {
  Compiler.workingSets = [data.file];
  Compiler.resetFiles();
  const { Runner } = reqiure('./src/runner');
  new Runner().runWorker(data, done);
});