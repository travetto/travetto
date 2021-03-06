const { PathUtil } = require('@travetto/boot/src/path');
PathUtil.cwd = PathUtil.resolveUnix(__dirname, '..');
process.env.TRV_ENV = 'prod';
require('@travetto/boot/register');
module.exports = require('./app.ts').TravettoGenerator;