#!/usr/bin/env node
require('@travetto/boot/bin/register');
process.argv = [process.argv0, 'trv-scaffold', 'scaffold', ...process.argv.slice(2)];
require('@travetto/cli/bin/cli').main();