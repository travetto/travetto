import { ColorOutputUtil } from '@travetto/terminal';

export const CONSOLE_ENHANCER = ColorOutputUtil.palette({
  assertDescription: 'lightGray',
  testDescription: 'white',
  success: 'green',
  failure: 'red',
  assertNumber: 'brightBlue',
  testNumber: 'brightBlue',
  assertFile: 'lightGreen',
  assertLine: 'lightYellow',
  objectInspect: 'magenta',
  suiteName: 'yellow',
  testName: 'cyan',
  total: 'white'
});

export type TestResultsEnhancer = typeof CONSOLE_ENHANCER;