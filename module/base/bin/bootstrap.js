#!/usr/bin/env node

// @ts-check
require('../src/bootstrap/register').registerLoaders();
require('../src/bootstrap/env').showEnv();

const mgr = module.exports = require('../src/phase').PhaseManager.init('bootstrap');

// @ts-ignore
if (require.main === module) {
  mgr.run();
}