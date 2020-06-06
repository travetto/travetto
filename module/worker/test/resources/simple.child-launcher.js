require('@travetto/boot/register');
require('@travetto/base').PhaseManager
  .init().then(() => require('./simple.child'));