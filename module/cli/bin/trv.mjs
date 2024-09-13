#!/usr/bin/env node

// @ts-check
import { getEntry } from '@travetto/compiler/bin/common.mjs';

getEntry().then(ops => ops.getLoader()).then(load => load('@travetto/cli/support/entry.trv.js'));