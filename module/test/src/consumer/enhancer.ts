import chalk from 'chalk';

import { ColorUtil } from '@travetto/base';

export const CONSOLE_ENHANCER = ColorUtil.palette({
  assertDescription: chalk.hex('#d3d3d3'), // light gray
  testDescription: chalk.white,
  success: chalk.green,
  failure: chalk.red,
  assertNumber: chalk.cyanBright,
  testNumber: chalk.hex('#1e90ff'), // dodger blue
  assertFile: chalk.hex('#90e90'), // lightGreen
  assertLine: chalk.hex('#ffffe0'), // light yellow
  objectInspect: chalk.magenta,
  suiteName: chalk.yellow,
  testName: chalk.cyan,
  total: chalk.white
});

export type TestResultsEnhancer = typeof CONSOLE_ENHANCER;