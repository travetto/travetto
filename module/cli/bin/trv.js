#!/usr/bin/env node

// @ts-check
const { getEntry } = require('@travetto/compiler/bin/common.js');

getEntry().then(ops => ops.getLoader()).then(load => load('@travetto/cli/support/entry.trv.js'));