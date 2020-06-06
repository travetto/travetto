process.env.TRV_GEN_CWD = process.cwd();
process.env.TRV_ENV = 'prod';
process.chdir(`${__dirname}/..`);
require('@travetto/boot/register');
module.exports = require('./app.ts').TravettoGenerator;