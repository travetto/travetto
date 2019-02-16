const { FsUtil } = require('@travetto/base/src/bootstrap/fs-util');
process.env.INIT_CWD = FsUtil.toUnix(process.cwd());
process.chdir(FsUtil.resolveUnix(__dirname, '..'));

process.env.DEBUG = '0';
require('@travetto/base/bin/bootstrap');
module.exports = require('./app.ts');