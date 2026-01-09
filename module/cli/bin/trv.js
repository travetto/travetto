#!/usr/bin/env node
// @ts-check
import '@travetto/manifest/bin/hook.js';
import { getManifestContext } from '@travetto/manifest/src/context.ts';
import { main } from '@travetto/compiler/support/entry.main.ts';

const operations = await main(getManifestContext());
operations.exec('@travetto/cli/support/entry.trv.ts');