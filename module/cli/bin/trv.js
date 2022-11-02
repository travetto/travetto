#!/usr/bin/env node
require(`${process.env.TRV_DEV || '@travetto'}/boot/bin/bootstrap`).boot().then(() =>
  require('@travetto/cli/support/main.cli').main()
);