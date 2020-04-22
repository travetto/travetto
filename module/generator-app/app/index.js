process.chdir(`${__dirname}/..`);
process.env.QUIET_INIT = '1';
process.env.ENV = 'prod';
require('@travetto/boot/bin/init');
module.exports = require('./app.ts').TravettoGenerator;