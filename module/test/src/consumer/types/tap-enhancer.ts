type Primitive = string | number | boolean | null | undefined;

/**
 * Format for enhancing the tap output
 */
export interface TapEnhancer {
  objectInspect(val: Primitive): string;
  suiteName(val: string): string;
  testName(val: string): string;
  testDescription(val: string): string;
  assertDescription(val: string): string;
  assertFile(val: string): string;
  assertLine(val: number): string;
  testNumber(val: number): string;
  assertNumber(val: number): string;
  success(val: Primitive): string;
  failure(val: Primitive): string;
  total(val: number): string;
}

const ident = (x: Primitive) => `${x}`;

/**
 * Dummy enhancer does nothing
 */
export const DUMMY_ENHANCER = ([
  'objectInspect', 'suiteName', 'testName', 'testDescription', 'assertDescription',
  'assertFile', 'assertLine', 'testNumber', 'assertNumber', 'success', 'failure', 'total'
] as const)
  .reduce((acc, v) => {
    acc[v] = ident;
    return acc;
  }, {} as TapEnhancer);