import { TestConfig, TestResult } from './test';
import { Class } from '@encore2/registry';

export interface SuiteConfig {
  class: Class;
  instance: any;
  description: string;
  tests: TestConfig[];
}

export interface Counts {
  passed: number;
  skipped: number;
  failed: number;
  total: number;
}

export interface SuiteResult extends Counts {
  file: string;
  class: string;
  tests: TestResult[];
  description: string;
}

export interface SuitesResult extends Counts {
  suites: SuiteResult[];
}