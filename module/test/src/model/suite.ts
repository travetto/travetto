import { Class } from '@travetto/registry/src/types';

import { TestConfig, TestResult } from './test';

// TODO: Document
export interface SuiteConfig {
  class: Class;
  classId: string;
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
  passed: number;
  skipped: number;
  failed: number;
  total: number;
}

// TODO: Document
export interface SuiteResult extends Counts {
  classId: string;
  file: string;
  lines: { start: number, end: number };
  tests: TestResult[];
  duration: number;
}

// TODO: Document
export interface AllSuitesResult extends Counts {
  suites: SuiteResult[];
  errors: Error[];
  duration: number;
}