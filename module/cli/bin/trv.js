#!/usr/bin/env node
// @ts-check
import '@travetto/compiler/bin/hook.js';
import { invokeModule } from '@travetto/compiler/support/operations.ts';
invokeModule('@travetto/cli/support/entry.trv.js');