#!/usr/bin/env -S NODE_OPTIONS='--enable-source-maps' '--disable-proto=delete' node

// @ts-check
import { getEntry } from '@travetto/compiler/bin/common.js';

getEntry().then(ops => ops.compile('run')).then(load => load('@travetto/cli/support/entry.trv.js'));