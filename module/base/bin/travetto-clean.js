#!/usr/bin/env node

const { AppEnv: { cwd } } = require('../src/env');
const { Cache } = require('../src/cache');

new Cache(cwd).clear();