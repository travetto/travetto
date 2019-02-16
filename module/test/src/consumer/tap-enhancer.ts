type Primitive = string | number | boolean | null | undefined;

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

export const DUMMY_ENHANCER = [
  'objectInspect', 'suiteName', 'testName', 'testDescription', 'assertDescription',
  'assertFile', 'assertLine', 'testNumber', 'assertNumber', 'success', 'failure', 'total'
]
  .reduce((acc, v) => {
    (acc as any)[v] = ident;
    return acc;
  }, {} as TapEnhancer);