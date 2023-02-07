import fs from 'fs';
import { install } from 'source-map-support';
install();

import { Compiler } from '../src/compiler';
const dirtyFiles = fs.readFileSync(process.argv[2], 'utf8').split(/\n/).filter(x => !!x);
new Compiler(dirtyFiles).run(process.argv[3] === 'true');