#!/usr/bin/env node

const { Env: { cwd } } = require('../src/env');
const { Cache } = require('../src/cache');

new Cache(cwd).clear();