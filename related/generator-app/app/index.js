process.env.TRV_ENV = 'prod';
const { PathUtil } = require('@travetto/boot/src/path');
PathUtil.cwd = PathUtil.resolveUnix(__dirname, '..');
require('@travetto/boot/bin/register');
module.exports = require('./app').TravettoGenerator;