process.env.FINAL_CWD = process.cwd();
process.chdir(`${__dirname}/..`);
process.env.ENV = 'prod';
require('@travetto/boot/bin/init');
module.exports = require('./app.ts').TravettoGenerator;