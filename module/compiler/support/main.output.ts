import { readFileSync } from 'fs';
import { install } from 'source-map-support';

import { ManifestState } from '@travetto/manifest';

import { Compiler } from '../src/compiler';

install();
const [manifestState, watch] = process.argv.slice(2);
const state: ManifestState = JSON.parse(readFileSync(manifestState, 'utf8'));
new Compiler().init(state).run(watch === 'true');