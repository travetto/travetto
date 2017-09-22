#!/usr/bin/env node

process.env.ENV = 'test';
process.env.NO_WATCH = true;
require('@encore2/base/bootstrap');

const { Compiler } = require('@encore2/compiler');

process.on('message', async function({ jobId, file, type }) {
  console.log('on message', arguments)
  if (type === 'init') {
    Compiler.init(process.cwd());
    process.send({ type: 'initComplete' });
  } else if (type === 'run') {
    Compiler.workingSets = [file];
    Compiler.resetFiles();
    try {
      await require('./src/service/executor').Executor.executeFile(file);
      process.send({ jobId, type: 'runComplete', success: true });
    } catch (e) {
      process.send({ jobId, type: 'runComplete', success: false, error: e.message });
    }
  }
});

if (process.send) {
  process.send({ type: 'ready' });
  setTimeout(_ => {}, Number.MAX_SAFE_INTEGER);
}