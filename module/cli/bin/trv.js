#!/usr/bin/env node
// @ts-check
import '@travetto/manifest/bin/hook.js';
import operations from '@travetto/compiler/support/entry.main.ts';

operations.exec('@travetto/cli/support/entry.trv.js');