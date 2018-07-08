import * as compiler from '../src/compiler';

setInterval(() => {
  console.log(compiler.Compiler.cwd);
}, 2000);