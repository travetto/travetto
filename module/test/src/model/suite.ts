import { TestConfig, TestResult } from './test';
import { Class } from '@encore2/registry/src/model/types';

export interface SuiteConfig {
  class: Class;
  instance: any;
  name: string;
  line: number;
  lineEnd: number;
  tests: TestConfig[];
}

export interface Counts {
  success: number;
  skip: number;
  fail: number;
  total: number;
}

export interface SuiteResult extends Counts {
  file: string;
  line: number;
  lineEnd: number;
  class: string;
  tests: TestResult[];
  name: string;
}

export interface AllSuitesResult extends Counts {
  suites: SuiteResult[];
}