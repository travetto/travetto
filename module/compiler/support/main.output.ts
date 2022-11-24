import { readFileSync } from 'fs';
import { install } from 'source-map-support';

import { ManifestState } from '@travetto/manifest';

import { Compiler } from '../src/compiler';

install();
const [stateFile, outDir] = process.argv.slice(2);
const state: ManifestState = JSON.parse(readFileSync(stateFile, 'utf8'));
new Compiler().init(state, outDir).run();