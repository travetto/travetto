#!/usr/bin/env node
require('@travetto/boot/bin/bootstrap').boot().then(() =>
  require('@travetto/cli/support/main.cli').main()
);