import { TestConfig, TestResult } from './test';
import { Class } from '@encore2/registry';

export interface SuiteConfig {
  class: Class;
  instance: any;
  name: string;
  line: number;
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
  line: number;
  class: string;
  tests: TestResult[];
  name: string;
}

export interface AllSuitesResult extends Counts {
  suites: SuiteResult[];
}