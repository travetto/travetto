require('@travetto/boot/bin/init')
  .libRequire('@travetto/base')
  .PhaseManager.run().then(() => {
    const { Compiler } = require('@travetto/compiler/src/compiler');
    return Compiler.compileAll();
  });
