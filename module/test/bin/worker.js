#!/usr/bin/env node

const { agent } = require('../src/exec/agent/agent-wrapper.js');

process.env.ENV = 'test';
process.env.NO_WATCH = true;
let Compiler;
if (!!process.env.DEBUG) {
  console.debug = console.log;
}

agent((done) => {
  console.debug('Init');
  require('@travetto/base/bootstrap');
  Compiler = require('@travetto/compiler').Compiler;
  Compiler.workingSets = ['!'];
  Compiler.init(process.cwd());
  done();
}, (data, done) => {
  console.debug('Run');

  // Clear require cache
  console.debug('Resetting', Object.keys(require.cache).length)
  for (let k of Object.keys(require.cache)) {
    if (/node_modules/.test(k) && !/@travetto/.test(k)) {
      continue;
    }
    if (k.endsWith('.ts') &&
      !/@travetto\/(base|config|compiler)/.test(k) &&
      !/transformer\..*\.ts/.test(k))
    {
      console.debug('Reset', k)
      delete require.cache[k];
    }
  }

  Compiler.workingSets = [data.file];
  Compiler.resetFiles();
  const { Runner } = require('../src/exec/runner');
  new Runner().runWorker(data, done);
});