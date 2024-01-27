import type vscode from 'vscode';

import type { Assertion, SuiteConfig, SuiteResult, TestConfig, TestEvent, TestResult } from '@travetto/test';

export type StatusUnknown = TestResult['status'] | 'unknown';
export type TestLevel = TestEvent['type'];

type ResultStyles = Record<string, vscode.TextEditorDecorationType>;

interface Result {
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
