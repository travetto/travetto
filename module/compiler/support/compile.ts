import { install } from 'source-map-support';
import fs from 'fs';

install();

const dirtyFiles = fs.readFileSync(process.argv[2], 'utf8').split(/\n/).filter(x => !!x);
const watch = process.argv[2] === 'true';

if (watch || dirtyFiles.length) {
  import('../src/compiler.js').then(c => new c.Compiler(dirtyFiles).run(watch));
}