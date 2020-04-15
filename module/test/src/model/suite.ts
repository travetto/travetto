import { Class } from '@travetto/registry/src/types';

import { TestConfig, TestResult } from './test';

export interface SuiteConfig {
  class: Class;
  className: string;
  file: string;
  lines: { start: number, end: number };
  skip: boolean;

  instance: any;
  description: string;
  tests: TestConfig[];
  beforeAll: Function[];
  beforeEach: Function[];
  afterEach: Function[];
  afterAll: Function[];
}

export interface Counts {
  success: number;
  skip: number;
  fail: number;
  total: number;
}

export interface SuiteResult extends Counts {
  className: string;
  file: string;
  lines: { start: number, end: number };
  tests: TestResult[];
  duration: number;
}

export interface AllSuitesResult extends Counts {
  suites: SuiteResult[];
  errors: Error[];
  duration: number;
}