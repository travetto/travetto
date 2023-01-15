import { GlobalTerminal } from '@travetto/terminal';

export const CONSOLE_ENHANCER = GlobalTerminal.palette({
  assertDescription: 'lightGray',
  testDescription: 'white',
  success: 'green',
  failure: 'red',
  assertNumber: 'brightCyan',
  testNumber: 'dodgerBlue',
  assertFile: 'lightGreen',
  assertLine: 'lightYellow',
  objectInspect: 'magenta',
  suiteName: 'yellow',
  testName: 'cyan',
  total: 'white'
});

export type TestResultsEnhancer = typeof CONSOLE_ENHANCER;