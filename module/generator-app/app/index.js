const path = require('path');
process.env.FINAL_CWD = process.cwd();
process.chdir(path.dirname(__dirname));

process.env.DEBUG = '0';
require('@travetto/base/bin/bootstrap');
module.exports = require('./app.ts');