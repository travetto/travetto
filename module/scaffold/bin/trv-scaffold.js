#!/usr/bin/env node
const os = require('os');
process.argv = [...process.argv.slice(0, 2), 'scaffold', ...process.argv.slice(2)];
process.env.TRV_OUTPUT = `${os.tmpdir()}/trv-scaffold`;
require('@travetto/compiler/bin/trv');