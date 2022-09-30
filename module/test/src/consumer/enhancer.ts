import { ColorUtil } from '@travetto/boot';

export const { palette: COLOR_ENHANCER } = ColorUtil.buildColorTemplate({
  assertDescription: ['white'],
  testDescription: ['white', 'faint', 'bold'],
  success: ['green', 'faint', 'bold'],
  failure: ['red', 'faint', 'bold'],
  assertNumber: ['blue', 'bold'],
  testNumber: ['blue', 'bold'],
  assertFile: ['cyan'],
  assertLine: ['yellow'],
  objectInspect: ['magenta'],
  suiteName: ['yellow', 'faint', 'bold'],
  testName: ['cyan', 'bold'],
  total: ['white', 'bold']
});

export type TestResultsEnhancer = typeof COLOR_ENHANCER;

/**
 * Dummy enhancer does nothing
 */
export const DUMMY_ENHANCER: TestResultsEnhancer = [
  Object.keys(COLOR_ENHANCER)
    .reduce<Partial<TestResultsEnhancer>>((acc, k) => (acc[k] = (x: unknown): string => `${x}`) && acc, {})
].filter((x): x is TestResultsEnhancer => !!x)[0];