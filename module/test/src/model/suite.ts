import { TestConfig, TestResult } from './test';
import { Class } from '@travetto/registry/src/model/types';

export interface SuiteConfig {
  class: Class;
  className: string;
  file: string;
  lines: { start: number, end: number };

  instance: any;
  description: string;
  tests: TestConfig[];
  beforeAll: Function[];
  beforeEach: Function[];
  afterEach: Function[];
  afterAll: Function[]
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
}

export interface AllSuitesResult extends Counts {
  suites: SuiteResult[];
  errors: Error[];
}