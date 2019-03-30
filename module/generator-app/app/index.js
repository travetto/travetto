process.env.FINAL_CWD = process.cwd();
process.chdir(`${__dirname}/..`);
process.env.QUIET_INIT = '1';
process.env.ENV = 'prod';
require('@travetto/base/bin/start');
module.exports = require('./app.ts').TravettoGenerator;