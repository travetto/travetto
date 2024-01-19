#!/usr/bin/env -S node --disable-proto=delete --enable-source-maps
process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS ?? ''} --enable-source-maps --disable-proto=delete`;

// Make sure we turn it on
process.setSourceMapsEnabled(true);

// @ts-check
import { getEntry } from '@travetto/compiler/bin/common.js';

getEntry().then(ops => ops.compile('run')).then(load => load('@travetto/cli/support/entry.trv.js'));