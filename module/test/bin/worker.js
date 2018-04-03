#!/usr/bin/env node

process.env.ENV = 'test';
process.env.NO_WATCH = true;

const startup = require('@travetto/base/bootstrap');
const { run } = require('src/exec/test-worker');

run();