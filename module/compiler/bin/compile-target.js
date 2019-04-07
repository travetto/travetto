require('@travetto/boot/bin/init');
const { PhaseManager } = require(`@travetto/base`);

PhaseManager.run().then(() => {
  const { Compiler } = require('../src/compiler');
  return Compiler.compileAll();
});
