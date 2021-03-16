#!/usr/bin/env node
require('./register');
const [, , file, ...args] = process.argv;
const mod = /^[.\/\\]/.test(file) ? require('path').resolve(file) : file;
require(mod).main(...args);