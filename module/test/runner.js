#!/usr/bin/env node
process.env.ENV = 'test';
require('@encore2/base/bootstrap');
const { Compiler } = require('@encore2/compiler');
Compiler.workingSets = ['!'];
Compiler.init(process.cwd());

const { Executor } = require('./src');

async function run() {
  let results = await Executor.exec(process.argv.slice(2)); // Pass globs
  let formatter = require('./src/formatter/' + (process.env.FORMATTER || 'tap'));
  let output = Object.values(formatter)[0](results);
  console.log(output);
}

run();