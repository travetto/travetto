import { readFileSync } from 'fs';
import * as vscode from 'vscode';

import { Decorations } from './decoration';
import {
  AllState, TestState, ResultState,
  TestEvent, SuiteResult, TestResult, Assertion,
  SuiteConfig, SuiteState, Level,
  StatusUnknown,
  RemoveEvent
} from './types';

const diagColl = vscode.languages.createDiagnosticCollection('Travetto');

/**
 * Test results manager
 */
export class DocumentResultsManager {

  #results: AllState = {
    suite: {},
    test: {}
  };

  #failedAssertions: Record<number, Assertion> = {};
  #diagnostics: vscode.Diagnostic[] = [];
  #editors = new Set<vscode.TextEditor>();
  #document: vscode.TextDocument;
  #file: string;
  active = false;

  constructor(file: string) {
    this.#file = file;
  }

  /**
   * Get list of known tests
   */
  getListOfTests(): { name: string, start: number, code: number }[] {
    return Object.values(this.#results.test)
      .map(v => ({
        name: v.src.methodName,
        start: v.src.lines.start,
        code: v.src.lines.codeStart
      }));
  }

  /**
   * Support a new editor for results updating
   * @param e
   */
  addEditor(e: vscode.TextEditor): void {
    if (!this.#editors.has(e)) {
      this.#editors.add(e);
      this.#document = e.document;
      try {
        this.refresh();
      } catch (err) {
        console.error(err);
      }
    }
  }

  /**
   * Remove an editor
   * @param e
   */
  removeEditor(e: vscode.TextEditor): void {
    if (!this.#editors.has(e)) {
      this.#editors.delete(e);
    }
  }

  /**
   * Set all styles for all open editors
   * @param type
   * @param decs
   */
  setStyle(type: vscode.TextEditorDecorationType, decs: vscode.DecorationOptions[]): void {
    if (type) {
      for (const ed of this.#editors) {
        ed.setDecorations(type, decs);
      }
    }
  }

  /**
   * Shutdown results manager
   */
  dispose(): void {
    this.#editors.clear();

    for (const suite of Object.values(this.#results.suite)) {
      for (const style of Object.values(suite.styles)) { style.dispose(); }
    }
    for (const test of Object.values(this.#results.test)) {
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

      const out: Record<StatusUnknown, vscode.DecorationOptions[]> = { passed: [], failed: [], unknown: [], skipped: [] };
      for (const assertion of test.assertions) {
        out[assertion.status].push(assertion.decoration);
      }
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      for (const k of Object.keys(out) as StatusUnknown[]) {
        this.setStyle(test.assertStyles[k], out[k]);
      }
    }
  }

  /**
   * Refresh all results
   */
  refresh(): void {
    for (const suite of Object.values(this.#results.suite)) {
      if (suite.decoration && suite.status) {
        this.setStyle(suite.styles[suite.status], [suite.decoration]);
      }
    }
    for (const test of Object.values(this.#results.test)) {
      this.refreshTest(test);
    }
  }

  findDocument(file: string): vscode.TextDocument {
    const content = readFileSync(file, 'utf8');
    const self = {
      lines: content.split(/\n/g),
      lineAt(line: number): { firstNonWhitespaceCharacterIndex: number } {
        return {
          firstNonWhitespaceCharacterIndex: (self.lines[line].length - self.lines[line].trimLeft().length)
        };
      }
    };
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return self as unknown as vscode.TextDocument;
  }

  /**
   * Refresh global diagnostics
   */
  refreshDiagnostics(): void {
    let document = this.#document;

    this.#diagnostics = Object.values(this.#results.test)
      .filter(x => x.status === 'failed')
      .reduce<vscode.Diagnostic[]>((acc, ts) => {
        for (const as of ts.assertions) {
          if (as.status !== 'failed' || as.src.classId === 'unknown') {
            continue;
          }
          const { bodyFirst } = Decorations.buildErrorHover(as.src);
          const rng = as.decoration!.range;

          document ??= this.findDocument(this.#file);

          const diagRng = new vscode.Range(
            new vscode.Position(rng.start.line,
              document.lineAt(rng.start.line).firstNonWhitespaceCharacterIndex
            ),
            rng.end
          );
          const diag = new vscode.Diagnostic(diagRng, `${ts.src.classId.split(/[^a-z-/]+/i).pop()}.${ts.src.methodName} - ${bodyFirst}`, vscode.DiagnosticSeverity.Error);
          diag.source = '@travetto/test';
          acc.push(diag);
        }
        if (ts.status === 'failed' && ts.assertions.length === 0) {
          document ??= this.findDocument(this.#file);
          const rng = ts.decoration!.range!;
          const diagRng = new vscode.Range(
            new vscode.Position(rng.start?.line,
              document.lineAt(rng.start.line).firstNonWhitespaceCharacterIndex
            ),
            rng.end
          );
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          const err = (ts.src as TestResult).error!.message.split(/\n/).shift();
          const diag = new vscode.Diagnostic(diagRng, `${ts.src.classId.split(/[^a-z-/]+/i).pop()}.${ts.src.methodName} - ${err}`, vscode.DiagnosticSeverity.Error);
          diag.source = '@travetto/test';
          acc.push(diag);
        }
        return acc;
      }, []);
    diagColl.set(vscode.Uri.file(this.#file), this.#diagnostics);
  }

  /**
   * Store results information
   * @param level The level of the results
   * @param key The test key
   * @param status The status
   * @param decoration UI Decoration
   * @param src
   */
  store(
    level: Level,
    key: string,
    status: StatusUnknown,
    decoration: vscode.DecorationOptions,
    src?: Assertion | SuiteResult | SuiteConfig | TestResult | TestEvent
  ): void {
    switch (level) {
      case 'assertion': {
        const el = this.#results.test[key];
        const groups: Record<StatusUnknown, vscode.DecorationOptions[]> = { passed: [], failed: [], unknown: [], skipped: [] };
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const assertedSrc: Assertion = src as Assertion;
        el.assertions.push({ status, decoration, src: assertedSrc });

        for (const a of el.assertions) {
          groups[a.status].push(a.decoration);
        }

        for (const s of ['passed', 'failed', 'unknown'] as const) {
          this.setStyle(el.assertStyles[s], groups[s]);
        }
        break;
      }
      case 'suite': {
        const el = this.#results.suite[key];
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        el.src = src as SuiteResult;
        el.status = status;
        el.decoration = decoration;

        Object.keys(el.styles).forEach(x => {
          this.setStyle(el.styles[x], x === status ? [decoration] : []);
        });
        break;
      }
      case 'test': {
        const el = this.#results.test[key];
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        el.src = src as TestResult;
        el.status = status;
        el.decoration = decoration;
        this.setStyle(el.styles[status], [decoration]);
      }
    }
  }

  /**
   * Create all level styles
   * @param level
   */
  genStyles(level: Level): Record<'failed' | 'passed' | 'unknown', vscode.TextEditorDecorationType> {
    return {
      failed: Decorations.buildStyle(level, 'failed'),
      passed: Decorations.buildStyle(level, 'passed'),
      unknown: Decorations.buildStyle(level, 'unknown')
    };
  }

  /**
   * Reset all levels
   * @param level Level to reset
   * @param key The file to reset
   */
  reset(level: Exclude<Level, 'assertion'>, key: string): void {
    const existing = this.#results[level][key];
    const base: ResultState<unknown> = {
      status: 'unknown',
      styles: this.genStyles(level),
      src: (existing && existing.src)
    };

    if (existing) {
      Object.values(existing.styles).forEach(x => x.dispose());
      if (level === 'test') {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        Object.values((existing as TestState).assertStyles).forEach(x => x.dispose());
      }
    }
    switch (level) {
      case 'test': {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const testBase = (base as TestState);
        testBase.assertions = [];
        testBase.assertStyles = this.genStyles('assertion');
        this.#results[level][key] = testBase;
        break;
      }
      case 'suite': {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const suiteBase = (base as SuiteState);
        this.#results[level][key] = suiteBase;
        break;
      }
    }
  }

  /**
   * On suite results
   * @param suite
   */
  onSuite(suite: SuiteResult): void {
    const status = suite.skipped ? 'unknown' : (suite.failed ? 'failed' : 'passed');
    this.reset('suite', suite.classId);
    this.store('suite', suite.classId, status, Decorations.buildSuite(suite), suite);
  }

  /**
   * On test results
   * @param test
   */
  onTest(test: TestResult): void {
    const dec = Decorations.buildTest(test);
    const status = test.status === 'skipped' ? 'unknown' : test.status;
    this.store('test', `${test.classId}:${test.methodName}`, status, dec, test);

    this.refreshTest(`${test.classId}:${test.methodName}`);
    this.refreshDiagnostics();
  }

  /**
   * On test assertion
   * @param assertion
   */
  onAssertion(assertion: Assertion): void {
    const status = assertion.error ? 'failed' : 'passed';
    const key = `${assertion.classId}:${assertion.methodName}`;
    const dec = Decorations.buildAssertion(assertion);
    if (status === 'failed') {
      this.#failedAssertions[Decorations.line(assertion.line).range.start.line] = assertion;
    }
    this.store('assertion', key, status, dec, assertion);
  }

  /**
   * On a test event, update internal state
   */
  onEvent(e: TestEvent | RemoveEvent): void {
    if (e.type === 'removeTest') {
      this.reset('test', `${e.classId}:${e.method}`);
    } else if (e.phase === 'before') {
      switch (e.type) {
        case 'suite': {
          this.reset('suite', e.suite.classId);
          this.store('suite', e.suite.classId, 'unknown', Decorations.buildSuite(e.suite), e.suite);

          for (const test of Object.values(this.#results.test).filter(x => x.src.classId === e.suite.classId)) {
            this.reset('test', `${test.src.classId}:${test.src.methodName}`);
          }
          break;
        }
        // Clear diags
        case 'test': {
          const key = `${e.test.classId}:${e.test.methodName}`;
          this.reset('test', key);
          const dec = Decorations.buildTest(e.test);
          this.store('test', key, 'unknown', dec, e.test);
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
