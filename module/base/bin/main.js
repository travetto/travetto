#!/usr/bin/env node
require('@travetto/boot/bin/register');
require('..').PhaseManager.run('init').then(() => require('@travetto/boot/bin/main'));