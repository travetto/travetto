// @ts-check

const { FsUtil } = require('../src/fs-util');
const { AppCache } = require('../src/cache');
const { showEnv } = require('../src/env');

function clean() {
  FsUtil.unlinkRecursiveSync(AppCache.cacheDir);
}

async function runScript(script) {
  bootstrap();

  let res;
  try {
    res = require(FsUtil.resolveUnix(FsUtil.cwd, script));
  } catch {
    res = require(script);
  }

  return res;
}

function bootstrap() {
  require('../src/register').registerLoaders();
  showEnv();
}

module.exports = { clean, runScript, bootstrap };