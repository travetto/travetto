require('@travetto/base/main').run()
  .then(x => {
    const Compiler = require('../src/compiler').Compiler;
    Compiler.on('added', require);
    Compiler.on('changed', require);
    require('./watch');
  });
