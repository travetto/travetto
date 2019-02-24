// @ts-check

const { FsUtil } = require('../src/bootstrap/fs-util');
const { AppCache } = require('../src/bootstrap/cache');

function clean() {
  FsUtil.unlinkRecursiveSync(AppCache.cacheDir);
}

async function runScript(script, phase) {
  require('./bootstrap');

  if (phase && phase !== 'none') {
    await require('../src/phase')
      .PhaseManager.init(phase).run();
  }

  let res;
  try {
    res = require(FsUtil.resolveUnix(FsUtil.cwd, script));
  } catch {
    res = require(script);
  }

  return res;
}

module.exports = { clean, runScript };