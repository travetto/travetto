#!/usr/bin/env node
process.env.DEBUG = '0';
require('../../module/boot/bin/init');
require('./index').init();