import { Class } from '@encore2/registry';

export interface TestConfig {
  class: Class<any>;
  suiteName: string;
  description: string;
  method: string;
  shouldError: string | RegExp | Function;
  skip: boolean;
}

export interface Assertion {
  actual?: any;
  expected?: any;
  operator: string;
  message?: string;
  file: string;
  line: number;
  text: string;
  error?: any;
}

export interface TestResult {
  status: 'passed' | 'skipped' | 'failed';
  error?: Error;
  line: number;
  file: string;
  method: string;
  suiteName: string;
  description: string;
  assertions: Assertion[],
  output: {
    [key: string]: string;
  }
}