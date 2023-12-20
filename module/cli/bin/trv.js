#!/usr/bin/env -S node --disable-proto=delete --enable-source-maps

// @ts-check
import { getEntry } from '@travetto/compiler/bin/common.js';

getEntry().then(ops => ops.compile('run')).then(load => load('@travetto/cli/support/entry.trv.js'));