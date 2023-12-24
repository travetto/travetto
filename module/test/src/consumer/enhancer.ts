import { StyleUtil } from '@travetto/terminal';

export const CONSOLE_ENHANCER = StyleUtil.getPalette({
  assertDescription: '#d3d3d3', // light gray
  testDescription: '#e5e5e5', // White
  success: '#00cd00', // Green
  failure: '#cd0000', // Red
  assertNumber: '#00ffff', // Bright cyan
  testNumber: '#1e90ff', // dodger blue
  assertFile: '#90e90', // lightGreen
  assertLine: '#ffffe0', // light yellow
  objectInspect: '#cd00cd', // Magenta
  suiteName: '#cdcd00', // Yellow
  testName: '#00cdcd',  // Cyan
  total: '#e5e5e5', // White
});

export type TestResultsEnhancer = typeof CONSOLE_ENHANCER;