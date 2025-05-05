import type vscode from 'vscode';

import type { Assertion, SuiteConfig, SuiteResult, TestConfig, TestEvent, TestResult } from '@travetto/test';

export type StatusUnknown = TestResult['status'] | 'unknown';
export type TestLevel = TestEvent['type'];

type ResultStyles = Record<string, vscode.TextEditorDecorationType>;

export interface Result<T> {
  status: StatusUnknown;
  decoration: vscode.DecorationOptions;
  logDecorations?: vscode.DecorationOptions[];
  src: T;
}

export interface ResultState<T> extends Omit<Partial<Result<T>>, 'src'> {
  styles: ResultStyles;
  src: T;
}

export interface SuiteState extends ResultState<SuiteConfig | SuiteResult> {
}

export interface TestState extends ResultState<TestConfig | TestResult> {
  logStyle: vscode.TextEditorDecorationType;
  assertStyles: ResultStyles;
  assertions: Result<Assertion>[];
}

export interface AllState {
  suite: Record<string, SuiteState>;
  test: Record<string, TestState>;
}

export interface ErrorHoverAssertion {
  message: string;
  expected?: unknown;
  actual?: unknown;
  operator?: string;
  error: Error;
}
