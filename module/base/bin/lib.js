// @ts-check

function register(phase = 'init') {
  require('@travetto/boot/bin/boot');
  return require('../src/phase').PhaseManager.init(phase);
}

function start(phase = 'init') {
  return register(phase).run();
}

module.exports = { register, start };