#!/usr/bin/env node

// @ts-check
import { getEntry } from '@travetto/compiler/bin/common.js';

getEntry().then(ops => ops.compile('run')).then(load => load('@travetto/cli/support/entry.trv.js'));