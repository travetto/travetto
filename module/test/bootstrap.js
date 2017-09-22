#!/usr/bin/env node

process.env.ENV = 'test';
require('@encore2/base/bootstrap');
const { Runner } = require('./src/runner');
new Runner().run();