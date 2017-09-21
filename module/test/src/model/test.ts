import { Class } from '@encore2/registry';

export interface TestConfig {
  class: Class<any>;
  className: string;
  description: string;
  method: string;
  shouldError: string | RegExp | Function;
  skip: boolean;
}

export interface TestResult {
  status: 'passed' | 'skipped' | 'failed';
  error?: Error;
  method: string;
  description: string;
}