// @ts-check

const { FsUtil } = require('@travetto/boot');
const { register } = require('@travetto/boot/bin/lib');

function start(script, phase = 'init') {
  register();

  const mgr = require('../src/phase')
    .PhaseManager.init(phase);

  if (typeof script === 'string') {
    let res;
    mgr.run();

    try {
      res = require(FsUtil.resolveUnix(FsUtil.cwd, script));
    } catch {
      res = require(script);
    }

    return res;
  } else {
    return mgr.run();
  }
}

module.exports = { start };