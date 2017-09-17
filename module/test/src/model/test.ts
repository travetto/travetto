import { Class } from '@encore2/registry';

export interface TestConfig {
  class: Class<any>;
  description: string;
  method: string;
}

export interface TestResult {
  passed: boolean;
  skipped: boolean;
  failed: boolean;
  error?: Error;
}