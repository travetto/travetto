#!/usr/bin/env node
require(`${process.env.TRV_DEV || '@travetto/transformer'}/transformer/bin/init`).init();
require('@travetto/cli/support/main.cli').main();