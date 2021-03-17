import * as vscode from 'vscode';

export type Status = 'skipped' | 'failed' | 'passed';
export type StatusUnknown = Status | 'unknown';

export type SMap<V> = Record<string, V>;

export type Decs<T> = SMap<SMap<T>>;

export interface ResultStyles {
  [key: string]: vscode.TextEditorDecorationType;
}

export interface Result {
  status: StatusUnknown;
  decoration: vscode.DecorationOptions;
}

export interface ResultState<T> extends Partial<Result> {
  styles: ResultStyles;
  src: T;
}

export interface SuiteState extends ResultState<SuiteConfig | SuiteResult> {
}

export interface TestState extends ResultState<TestConfig | TestResult> {
  assertStyles: ResultStyles;
  assertions: (Result & { src: Assertion })[];
}

export interface AllState {
  suite: SMap<SuiteState>;
  test: SMap<TestState>;
}

export interface SuiteConfig {
  file: string;
  classId: string;
  lines: { start: number, end: number };
}

export interface TestCore extends SuiteConfig {
  lines: { start: number, end: number, codeStart: number };
}

export interface SuiteResult extends SuiteConfig {
  skipped: number;
  failed: number;
  passed: number;
}

export interface TestConfig extends TestCore {
  methodName: string;
}

export interface TestResult extends TestConfig {
  status: Status;
  assertions?: Assertion[];
  error?: Error;
}

export interface Assertion {
  expected?: unknown;
  actual?: unknown;
  operator?: string;
  file: string;
  classId: string;
  methodName: string;
  status: Status;
  error?: Error;
  message: string;
  line: number;
  lineEnd?: number;
}

export type TestEvent =
  { phase: 'before', type: 'suite', suite: SuiteConfig } |
  { phase: 'after', type: 'suite', suite: SuiteResult } |
  { phase: 'before', type: 'test', test: TestConfig } |
  { phase: 'after', type: 'test', test: TestResult } |
  { phase: 'after', type: 'assertion', assertion: Assertion };

export type Level = TestEvent['type'];

export interface ErrorHoverAssertion {
  message: string;
  expected?: unknown;
  actual?: unknown;
  operator?: string;
  error: Error;
}

export type RemoveEvent = {
  type: 'removeTest';
  method: string;
  file: string;
  classId: string;
};