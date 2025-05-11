import vscode from 'vscode';

import { TypedObject } from '@travetto/runtime';

import type { Assertion, TestResult, SuiteResult, SuiteConfig, TestConfig, TestWatchEvent } from '@travetto/test';

import { Decorations } from './decoration.ts';
import { AllState, TestState, ResultState, SuiteState, TestLevel, StatusUnknown, Result } from './types.ts';
import { Workspace } from '../../../core/workspace.ts';

type TestItem = Assertion | TestResult | TestConfig | SuiteResult | SuiteConfig;

function isTestState(level: string, state: ResultState<unknown>): state is TestState {
  return level === 'test';
}

function isSuiteState(level: string, state: ResultState<unknown>): state is SuiteState {
  return level === 'suite';
}

function isAssertion(level: string, result?: Result<TestItem>): result is Result<Assertion> {
  return level === 'assertion';
}

function isTestResult(level: string, result?: Result<TestItem>): result is Result<TestResult> {
  return level === 'test';
}

function isSuiteResult(level: string, result?: Result<TestItem>): result is Result<SuiteResult> {
  return level === 'suite';
}

/**
 * Test results manager
 */
export class DocumentResultsManager {

  #results: AllState = { suite: {}, test: {} };
  #failedAssertions: Record<number, Assertion> = {};
  #document: vscode.TextDocument;
  #editor?: vscode.TextEditor;
  active = false;

  constructor(doc: vscode.TextDocument) {
    this.#document = doc;
  }

  get editor(): vscode.TextEditor | undefined {
    return this.#editor;
  }

  set editor(ed: vscode.TextEditor | undefined) {
    if (ed !== this.#editor || ed === undefined) {
      this.#editor = ed;
      if (ed) {
        this.refresh();
      }
    }
  }

  clear() {
    this.#results = { suite: {}, test: {} };
    this.#failedAssertions = {};
  }

  /**
   * Get list of known tests
   */
  getListOfTests(): Pick<TestConfig, 'methodName' | 'lineStart' | 'lineBodyStart'>[] {
    return Object.values(this.#results.test).map(v => ({
      methodName: v.src.methodName,
      lineStart: v.src.lineStart,
      lineBodyStart: v.src.lineBodyStart
    }));
  }

  /**
   * Set all styles for all open editors
   * @param type
   * @param decs
   */
  setStyle(type: vscode.TextEditorDecorationType, decs: vscode.DecorationOptions[] = []): void {
    if (type && this.#editor) {
      this.#editor.setDecorations(type, decs);
    }
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

  refreshTest(test: TestState | string): void {
    if (typeof test === 'string') {
      test = this.#results.test[test];
    }
    if (test.decoration && test.status) {
      this.setStyle(test.styles[test.status], [test.decoration]);
      this.setStyle(test.logStyle, test.logDecorations);

      const out: Record<StatusUnknown, vscode.DecorationOptions[]> = { passed: [], failed: [], unknown: [], skipped: [] };
      for (const assertion of test.assertions) {
        out[assertion.status].push(assertion.decoration);
      }
      for (const k of TypedObject.keys<Record<StatusUnknown, unknown>>(out)) {
        this.setStyle(test.assertStyles[k], out[k]);
      }
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
        this.setStyle(suite.styles[suite.status], [suite.decoration]);
      }
    }
    for (const test of Object.values(this.#results.test)) {
      this.refreshTest(test);
    }
  }

  /**
   * Store results information
   * @param level The level of the results
   * @param key The test key
   * @param result The result
   */
  store(level: TestLevel, key: string, result: Result<TestItem>): void {
    if (isAssertion(level, result)) {
      const el = this.#results.test[key];
      const groups: Record<StatusUnknown, vscode.DecorationOptions[]> = { passed: [], failed: [], unknown: [], skipped: [] };
      el.assertions.push(result);

      for (const a of el.assertions) {
        groups[a.status].push(a.decoration);
      }

      for (const s of ['passed', 'failed', 'unknown'] as const) {
        this.setStyle(el.assertStyles[s], groups[s]);
      }
    } else if (isSuiteResult(level, result)) {
      const el = this.#results.suite[key];
      Object.assign(el, result);

      Object.keys(el.styles).forEach(x => {
        this.setStyle(el.styles[x], x === result.status ? [el.decoration!] : []);
      });
    } else if (isTestResult(level, result)) {
      const el = this.#results.test[key];
      Object.assign(el, result);
      this.setStyle(el.styles[result.status], [result.decoration]);
      this.setStyle(el.logStyle, result.logDecorations);
    }
  }

  /**
   * Create all level styles
   * @param level
   */
  genStyles(level: TestLevel): Record<'failed' | 'passed' | 'unknown', vscode.TextEditorDecorationType> {
    return {
      failed: Decorations.buildStyle(level, 'failed'),
      passed: Decorations.buildStyle(level, 'passed'),
      unknown: Decorations.buildStyle(level, 'unknown'),
    };
  }

  /**
   * Reset all levels
   * @param level Level to reset
   * @param key The file to reset
   */
  reset(level: Exclude<TestLevel, 'assertion'>, key: string): void {
    const existing = this.#results[level][key];
    const base: ResultState<unknown> = {
      status: 'unknown',
      styles: this.genStyles(level),
      src: (existing && existing.src)
    };

    if (existing) {
      Object.values(existing.styles).forEach(x => x.dispose());
      if (isTestState(level, existing)) {
        existing.logStyle.dispose();
        Object.values(existing.assertStyles).forEach(x => x.dispose());
      }
    }
    if (isTestState(level, base)) {
      base.assertions = [];
      base.logStyle = Decorations.buildAssertStyle('unknown');
      base.assertStyles = this.genStyles('assertion');
      this.#results[level][key] = base;
    } else if (isSuiteState(level, base)) {
      this.#results[level][key] = base;
    }
  }

  /**
   * On suite results
   * @param suite
   */
  onSuite(suite: SuiteResult): void {
    const status = (suite.failed ? 'failed' : suite.passed ? 'passed' : 'skipped');
    this.reset('suite', suite.classId);
    this.store('suite', suite.classId, { status, decoration: Decorations.buildSuite(suite), src: suite });
  }

  /**
   * On test results
   * @param test
   */
  onTest(test: TestResult): void {
    this.store('test', `${test.classId}#${test.methodName}`, {
      status: test.status === 'skipped' ? 'unknown' : test.status,
      decoration: Decorations.buildTest(test),
      logDecorations: test.output
        .filter(x => Workspace.resolveImport(`${x.module}/${x.modulePath}`) === this.#document.fileName)
        .map(v => Decorations.buildTestLog(v)),
      src: test
    });
    this.refreshTest(`${test.classId}#${test.methodName}`);
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
    this.store('assertion', key, { status, decoration: Decorations.buildAssertion(assertion), src: assertion });
  }

  /**
   * On a test event, update internal state
   */
  onEvent(e: TestWatchEvent): void {
    if (e.type === 'ready' || e.type === 'log') {
      // Ignore
    } else if (e.type === 'removeTest') {
      if ('method' in e && typeof e.method === 'string') {
        this.reset('test', `${e.classId}#${e.method}`);
      } else {
        for (const method of e.methodNames ?? []) {
          this.reset('test', `${e.classId}#${method}`);
        }
      }
    } else if (e.phase === 'before') {
      switch (e.type) {
        case 'suite': {
          this.reset('suite', e.suite.classId);
          const tests = Object.values(this.#results.test).filter(x => x.src.classId === e.suite.classId);
          for (const test of tests) {
            this.reset('test', `${test.src.classId}#${test.src.methodName}`);
          }
          this.store('suite', e.suite.classId, { status: 'unknown', decoration: Decorations.buildSuite(e.suite), src: e.suite });
          break;
        }
        // Clear diags
        case 'test': {
          const key = `${e.test.classId}#${e.test.methodName}`;
          this.reset('test', key);
          this.store('test', key, { status: 'unknown', decoration: Decorations.buildTest(e.test), src: e.test });
          break;
        }
      }
    } else {
      switch (e.type) {
        case 'suite': this.onSuite(e.suite); break;
        case 'test': this.onTest(e.test); break;
        case 'assertion': this.onAssertion(e.assertion); break;
      }
    }
  }

  /**
   * Get full totals
   */
  getTotals(): { skipped: number, failed: number, passed: number, unknown: number, total: number } {
    const values = Object.values(this.#results.test);
    const total = values.length;
    let passed = 0;
    let unknown = 0;
    let failed = 0;
    let skipped = 0;

    for (const value of values) {
      switch (value.status) {
        case 'skipped': skipped += 1; break;
        case 'failed': failed++; break;
        case 'passed': passed++; break;
        default: unknown++; break;
      }
    }

    return { passed, unknown, skipped, failed, total };
  }
}
