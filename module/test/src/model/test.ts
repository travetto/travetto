import { Class } from '@travetto/registry/src/model/types';

export interface TestConfig {
  class: Class<any>;
  className: string;
  description: string;
  file: string;
  lines: { start: number, end: number };
  methodName: string;
  shouldThrow?: string | RegExp | Function | boolean;
  skip: boolean;
  timeout?: number;
}

export interface Assertion {
  className: string;
  methodName: string;
  actual?: any;
  expected?: any;
  operator: string;
  message?: string;
  error?: Error;
  file: string;
  line: number;
  text: string;
}

export interface TestResult {
  status: 'success' | 'skip' | 'fail';
  error?: Error;
  file: string;
  lines: { start: number, end: number };
  methodName: string;
  className: string;
  description: string;
  assertions: Assertion[],
  output: {
    [key: string]: string;
  }
}