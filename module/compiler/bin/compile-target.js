require('@travetto/boot/bin/init');

require(`@travetto/base`).PhaseManager.run().then(() => {
  const { Compiler } = require('../src/compiler');
  return Compiler.compileAll();
});
