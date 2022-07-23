import { ColorUtil } from '@travetto/boot';

export const COLOR_ENHANCER = {
  assertDescription: ColorUtil.makeColorer('white'),
  testDescription: ColorUtil.makeColorer('white', 'faint', 'bold'),
  success: ColorUtil.makeColorer('green', 'faint', 'bold'),
  failure: ColorUtil.makeColorer('red', 'faint', 'bold'),
  assertNumber: ColorUtil.makeColorer('blue', 'bold'),
  testNumber: ColorUtil.makeColorer('blue', 'bold'),
  assertFile: ColorUtil.makeColorer('cyan'),
  assertLine: ColorUtil.makeColorer('yellow'),
  objectInspect: ColorUtil.makeColorer('magenta'),
  suiteName: ColorUtil.makeColorer('yellow', 'faint', 'bold'),
  testName: ColorUtil.makeColorer('cyan', 'bold'),
  total: ColorUtil.makeColorer('white', 'bold')
};

export type TestResultsEnhancer = typeof COLOR_ENHANCER;

/**
 * Dummy enhancer does nothing
 */
export const DUMMY_ENHANCER: TestResultsEnhancer = [
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  (Object.keys(COLOR_ENHANCER) as (keyof typeof COLOR_ENHANCER)[])
    .reduce<Partial<TestResultsEnhancer>>((acc, k) => (acc[k] = (x: unknown): string => `${x}`) && acc, {})
].filter((x): x is TestResultsEnhancer => !!x)[0];