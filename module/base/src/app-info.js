const path = require('path');
const { Env } = require('./env');

const pkg = require(path.join(Env.cwd, 'package.json'));

const subName = pkg.name.split('/').pop();

module.exports = {
  AppInfo: {
    VERSION: pkg.version,
    NAME: pkg.name,
    SIMPLE_NAME: pkg.name.replace(/[@]/g, '').replace(/[\/]/g, '_'),
    PACKAGE: pkg.name.split('/')[0],
    LICENSE: pkg.license,
    AUTHOR: pkg.author,
    DESCRIPTION: pkg.description,
    SUB_NAME: subName,
    DEV_PACKAGES: Object.keys(pkg.devDependencies || {})
  },
  resolveFrameworkFile: (pth) => {
    if (pth.includes('@travetto')) {
      pth = pth.replace(/.*\/@travetto\/([^/]+)\/([^@]+)$/g, (all, name, rest) => {
        const mid = subName === name ? '' : `node_modules/@travetto/${name}/`;
        return `${Env.cwd}/${mid}${rest}`;
      });
    }
    return pth;
  }
};