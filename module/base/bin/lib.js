// @ts-check

const { register: bootRegister } = require('@travetto/boot/bin/lib');

function register(phase = 'init') {
  bootRegister();
  return require('../src/phase').PhaseManager.init(phase);
}

function start(phase = 'init') {
  return register(phase).run();
}

module.exports = { register, start };