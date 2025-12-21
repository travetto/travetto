import vscode from 'vscode';

import { TypedObject } from '@travetto/runtime';

import type { Assertion, TestResult, SuiteResult, SuiteConfig, TestConfig, TestWatchEvent, TestStatus, TestRemoveEvent } from '@travetto/test';

import { Decorations } from './decoration.ts';
import { AllState, TestState, ResultState, SuiteState, TestLevel, Result } from './types.ts';
import { Workspace } from '../../../core/workspace.ts';

type TestItem = Assertion | TestResult | TestConfig | SuiteResult | SuiteConfig;
type KeyInput = string | [string, string] | readonly [string, string];

const isTestState = (level: string, state: ResultState<unknown>): state is TestState => level === 'test';
const isSuiteState = (level: string, state: ResultState<unknown>): state is SuiteState => level === 'suite';
const isAssertion = (level: string, result?: Result<TestItem>): result is Result<Assertion> => level === 'assertion';
const isTestResult = (level: string, result?: Result<TestItem>): result is Result<TestResult> => level === 'test';
const isSuiteResult = (level: string, result?: Result<TestItem>): result is Result<SuiteResult> => level === 'suite';

/**
 * Test results manager
 */
export class DocumentResultsManager {

  #results: AllState = { suite: {}, test: {} };
  #failedAssertions: Record<number, Assertion> = {};
  #document: vscode.TextDocument;
  #editor?: vscode.TextEditor;
  active = false;

  constructor(document: vscode.TextDocument) {
    this.#document = document;
  }

  get editor(): vscode.TextEditor | undefined {
    return this.#editor;
  }

  set editor(editor: vscode.TextEditor | undefined) {
    if (editor !== this.#editor || editor === undefined) {
      this.#editor = editor;
      if (editor) {
        this.refresh();
      }
    }
  }

  /**
   * Set all styles for all open editors
   * @param type
   * @param decs
   */
  #setStyle(type: vscode.TextEditorDecorationType, decs: vscode.DecorationOptions[] = []): void {
    if (type && this.#editor) {
      this.#editor.setDecorations(type, decs);
    }
  }

  #refreshTest(test: TestState | string): void {
    if (typeof test === 'string') {
      test = this.#results.test[test];
    }
    if (test.decoration && test.status) {
      this.#setStyle(test.styles[test.status], [test.decoration]);
      this.#setStyle(test.logStyle, test.logDecorations);

      const out: Record<TestStatus, vscode.DecorationOptions[]> = { passed: [], failed: [], unknown: [], skipped: [] };
      for (const assertion of test.assertions) {
        out[assertion.status].push(assertion.decoration);
      }
      for (const key of TypedObject.keys<Record<TestStatus, unknown>>(out)) {
        this.#setStyle(test.assertStyles[key], out[key]);
      }
    }
  }

  /**
   * Store results information
   * @param level The level of the results
   * @param key The test key
   * @param result The result
   */
  #store(level: TestLevel, key: KeyInput, result: Result<TestItem>): void {
    if (typeof key !== 'string') {
      key = `${key[0]}#${key[1]}`;
    }
    if (isAssertion(level, result)) {
      const state = this.#results.test[key];
      const groups: Record<TestStatus, vscode.DecorationOptions[]> = { passed: [], failed: [], unknown: [], skipped: [] };
      state.assertions.push(result);

      for (const a of state.assertions) {
        groups[a.status].push(a.decoration);
      }

      for (const style of ['passed', 'failed', 'unknown', 'skipped'] as const) {
        this.#setStyle(state.assertStyles[style], groups[style]);
      }
    } else if (isSuiteResult(level, result)) {
      const state = this.#results.suite[key];
      Object.assign(state, result);

      Object.keys(state.styles).forEach(style => {
        this.#setStyle(state.styles[style], style === result.status ? [state.decoration!] : []);
      });
    } else if (isTestResult(level, result)) {
      const state = this.#results.test[key];
      Object.assign(state, result);
      this.#setStyle(state.styles[result.status], [result.decoration]);
      this.#setStyle(state.logStyle, result.logDecorations);
    }
  }

  /**
   * Remove test results
   */
  #remove(level: Exclude<TestLevel, 'assertion'>, key: KeyInput): void {
    if (typeof key !== 'string') {
      key = `${key[0]}#${key[1]}`;
    }
    const existing = this.#results[level][key];
    if (existing) {
      Object.values(existing.styles).forEach(style => style.dispose());
      if (isTestState(level, existing)) {
        existing.logStyle.dispose();
        Object.values(existing.assertStyles).forEach(style => style.dispose());
      }
      delete this.#results[level][key];
    }
  }

  /**
   * Create all level styles
   * @param level
   */
  #genStyles(level: TestLevel): Record<TestStatus, vscode.TextEditorDecorationType> {
    return {
      failed: Decorations.buildStyle(level, 'failed'),
      passed: Decorations.buildStyle(level, 'passed'),
      unknown: Decorations.buildStyle(level, 'unknown'),
      skipped: Decorations.buildStyle(level, 'skipped'),
    };
  }

  /**
   * Reset all levels
   * @param level Level to reset
   * @param key The file to reset
   */
  #reset(level: Exclude<TestLevel, 'assertion'>, key: KeyInput): void {
    if (typeof key !== 'string') {
      key = `${key[0]}#${key[1]}`;
    }
    const existing = this.#results[level][key];
    const base: ResultState<unknown> = {
      status: 'unknown',
      styles: this.#genStyles(level),
      source: (existing && existing.source)
    };

    if (existing) {
      Object.values(existing.styles).forEach(style => style.dispose());
      if (isTestState(level, existing)) {
        existing.logStyle.dispose();
        Object.values(existing.assertStyles).forEach(style => style.dispose());
      }
    }

    if (isTestState(level, base)) {
      base.assertions = [];
      base.logStyle = Decorations.buildAssertStyle('unknown');
      base.assertStyles = this.#genStyles('assertion');
      this.#results[level][key] = base;
    } else if (isSuiteState(level, base)) {
      this.#results[level][key] = base;
    }
  }

  /**
   * Get list of known tests
   */
  getListOfTests(): Pick<TestConfig, 'methodName' | 'lineStart' | 'lineBodyStart'>[] {
    return Object.values(this.#results.test).map(test => ({
      methodName: test.source.methodName,
      lineStart: test.source.lineStart,
      lineBodyStart: test.source.lineBodyStart
    }));
  }

  /**
   * Cleanup styles
   */
  dispose(): void {
    for (const suite of Object.values(this.#results.suite)) {
      for (const style of Object.values(suite.styles)) { style.dispose(); }
    }
    for (const test of Object.values(this.#results.test)) {
      test.logStyle.dispose();
      for (const style of Object.values(test.styles)) { style.dispose(); }
      for (const style of Object.values(test.assertStyles)) { style.dispose(); }
    }
  }

  /**
   * Refresh all results
   */
  refresh(): void {
    if (!this.#editor) {
      return;
    }
    for (const suite of Object.values(this.#results.suite)) {
      if (suite.decoration && suite.status) {
        this.#setStyle(suite.styles[suite.status], [suite.decoration]);
      }
    }
    for (const test of Object.values(this.#results.test)) {
      this.#refreshTest(test);
    }
  }

  /**
   * On suite start
   * @param suite
   */
  beforeSuite(suite: SuiteConfig): void {
    this.#reset('suite', suite.classId);
    for (const test of Object.values(suite.tests)) {
      this.#reset('test', [test.classId, test.methodName]);
    }
    this.#store('suite', suite.classId, { status: 'unknown', decoration: Decorations.buildSuite(suite), source: suite });
  }

  /**
   * On suite results
   * @param suite
   */
  afterSuite(suite: SuiteResult): void {
    this.#reset('suite', suite.classId);
    this.#store('suite', suite.classId, { status: suite.status, decoration: Decorations.buildSuite(suite), source: suite });
  }

  /**
   * On test start
   * @param test
   */
  beforeTest(test: TestConfig): void {
    const key = [test.classId, test.methodName] as const;
    this.#reset('test', key);
    this.#store('test', key, { status: 'unknown', decoration: Decorations.buildTest(test), source: test });
  }

  /**
   * On test complete
   * @param test
   */
  afterTest(test: TestResult): void {
    this.#store('test', `${test.classId}#${test.methodName}`, {
      status: test.status,
      decoration: Decorations.buildTest(test),
      logDecorations: test.output
        .filter(log => Workspace.resolveImport(`${log.module}/${log.modulePath}`) === this.#document.fileName)
        .map(log => Decorations.buildTestLog(log)),
      source: test
    });
    this.#refreshTest(`${test.classId}#${test.methodName}`);
  }

  /**
   * On test assertion
   * @param assertion
   */
  onAssertion(assertion: Assertion): void {
    const status = assertion.error ? 'failed' : 'passed';
    const key = `${assertion.classId}#${assertion.methodName}`;
    if (status === 'failed') {
      this.#failedAssertions[Decorations.line(assertion.line).range.start.line] = assertion;
    }
    this.#store('assertion', key, { status, decoration: Decorations.buildAssertion(assertion), source: assertion });
  }

  /**
   * On test remove
   */
  onTestRemove(event: TestRemoveEvent): void {
    if (event.classId && event.methodName) {
      this.#remove('test', [event.classId, event.methodName]);
    } else if (event.classId) {
      this.#remove('suite', event.classId);
    }
  }

  /**
   * On a test event, update internal state
   */
  onEvent(event: TestWatchEvent): void {
    switch (event.type) {
      case 'ready':
      case 'log': return;
      case 'removeTest': return this.onTestRemove(event);
      case 'assertion': this.onAssertion(event.assertion); break;
      case 'suite': return (event.phase === 'before') ?
        this.beforeSuite(event.suite) :
        this.afterSuite(event.suite);
      case 'test': return (event.phase === 'before') ?
        this.beforeTest(event.test) :
        this.afterTest(event.test);
    }
  }
}