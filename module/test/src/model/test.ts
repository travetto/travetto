import { Class } from '@encore2/registry';

export interface TestConfig {
  class: Class<any>;
  description: string;
  method: string;
}

export interface TestResult {
  status: 'passed' | 'skipped' | 'failed';
  error?: Error;
  method: string;
  description: string;
}