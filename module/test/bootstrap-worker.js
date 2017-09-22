#!/usr/bin/env node

const { agent } = require('./src/service/agent/agent-wrapper.js');

agent((done) => {
  process.env.ENV = 'test';
  process.env.NO_WATCH = true;
  Compiler = require('@encore2/compiler').Compiler;
  Compiler.init(process.cwd());
  done();
}, (done) => {
  Compiler.workingSets = [data.file];
  Compiler.resetFiles();
  const { Runner } = reqiure('./src/runner');
  new Runner().runWorker(data, done);
});