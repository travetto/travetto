#!/usr/bin/env node
require('./register');
const path = require('path');
const [, , file, ...args] = process.argv;
const mod = /^[.\/\\]/.test(file) ? path.resolve(file) : file;
require(mod).main(...args);