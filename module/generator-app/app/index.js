process.env.TRV_GEN_CWD = process.cwd();
process.chdir(`${__dirname}/..`);
process.env.TRV_ENV = 'prod';
require('@travetto/boot/bin/init');
module.exports = require('./app.ts').TravettoGenerator;