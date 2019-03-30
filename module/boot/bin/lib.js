// @ts-check

const { FsUtil } = require('../src/fs-util');
const { AppCache } = require('../src/cache');
const { Env } = require('../src/env');

function clean() {
  FsUtil.unlinkRecursiveSync(AppCache.cacheDir);
}

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

function register() {
  require('../src/register').registerLoaders();
  Env.show();
}

module.exports = { clean, runScript, register };