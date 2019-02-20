// @ts-check

require('./init');
require('@travetto/base/bin/bootstrap');
const { TestRunWorker } = require('../src/worker/runner');
new TestRunWorker().start();