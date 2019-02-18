// @ts-check

const { FsUtil } = require('./fs-util');

const pkg = require(FsUtil.joinUnix(FsUtil.cwd, 'package.json'));

const subName = pkg.name.split('/').pop();

module.exports = {
  AppInfo: {
    VERSION: pkg.version,
    NAME: pkg.name,
    SIMPLE_NAME: pkg.name.replace(/[@]/g, '').replace(/[\/]/g, '_'),
    PACKAGE: pkg.name.split('/')[0],
    LICENSE: pkg.license,
    AUTHOR: pkg.author,
    MAIN: pkg.main,
    DESCRIPTION: pkg.description,
    SUB_NAME: subName,
    DEV_PACKAGES: Object.keys(pkg.devDependencies || {})
  }
};