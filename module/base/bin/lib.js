// @ts-check

const { FsUtil } = require('../bootstrap/fs-util');
const { AppCache } = require('../bootstrap/cache');

function clean() {
  FsUtil.unlinkRecursiveSync(AppCache.cacheDir);
}

async function runScript(script, phase) {
  bootstrap();

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

function bootstrap(run = false) {
  require('../bootstrap/register').registerLoaders();
  require('../bootstrap/env').Env.show();

  const mgr = require('../src/phase').PhaseManager.init('bootstrap');
  if (run) {
    mgr.run();
  }
  return mgr;
}

module.exports = { clean, runScript, bootstrap };