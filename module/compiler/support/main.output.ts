import { readFileSync } from 'fs';
import { install } from 'source-map-support';

import { ManifestState } from '@travetto/manifest';

import { Compiler } from '../src/compiler';

install();
const state: ManifestState = JSON.parse(readFileSync(process.argv[2], 'utf8'));
new Compiler().init(state).run();