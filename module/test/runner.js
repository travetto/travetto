#!/usr/bin/env node

process.env.ENV = 'test';
require('@encore2/base/bootstrap');

const {
  Compiler
} = require('@encore2/compiler');
Compiler.workingSets = process.argv.slice(2);
Compiler.init(process.cwd());

const {
  Executor,
  TapListener
} = require('./src');

async function run() {
  try {
    let results = await Executor.exec(process.argv.slice(2), [
      new TapListener()
    ]); // Pass globs
    let formatter = require('./src/formatter/' + (process.env.FORMATTER || 'noop'));
    let output = Object.values(formatter)[0](results);
    if (output) {
      console.log(output);
    }
  } catch (e) {
    console.error(e);
  }
}
run();