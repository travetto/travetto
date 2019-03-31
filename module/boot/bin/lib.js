// @ts-check

const { FsUtil } = require('../src/fs-util');
const { AppCache } = require('../src/cache');

function clean() {
  FsUtil.unlinkRecursiveSync(AppCache.cacheDir);
}

const { register } = require('../src/register');

async function runScript(script) {
  register();

  let res;
  try {
    res = require(FsUtil.resolveUnix(FsUtil.cwd, script));
  } catch {
    res = require(script);
  }

  return res;
}

module.exports = { clean, runScript, register };