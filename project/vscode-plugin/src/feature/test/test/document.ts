import * as fs from 'fs';
import * as vscode from 'vscode';

import { Decorations } from './decoration';
import {
  AllState, TestState, ResultState,
  TestEvent, SuiteResult, TestResult, Assertion,
  SuiteState, Level,
  ErrorHoverAssertion,
  StatusUnknown,
  RemoveEvent
} from './types';

const diagColl = vscode.languages.createDiagnosticCollection('Travetto');

function isDisposable(o: any): o is { _disposed: boolean } {
  return '_disposed' in o;
}

/**
 * Test results manager
 */
export class DocumentResultsManager {

  private results: AllState = {
    suite: {},
    test: {}
  };

  private failedAssertions: Record<number, Assertion> = {};
  private diagnostics: vscode.Diagnostic[] = [];
  private editors = new Set<vscode.TextEditor>();
  private document: vscode.TextDocument;
  public active = false;

  constructor(private file: string) { }

  /**
   * Get list of known tests
   */
  getListOfTests() {
    return Object.values(this.results.test)
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
  addEditor(e: vscode.TextEditor) {
    if (!this.editors.has(e)) {
      const elements = [...this.editors].filter(x => isDisposable(x) && x._disposed);
      this.editors = new Set([...elements, e]);
      this.document = e.document;
      try {
        this.refresh();
      } catch (err) {
        console.error(err);
      }
    }
  }

  /**
   * Set all styles for all open editors
   * @param type
   * @param decs
   */
  setStyle(type: vscode.TextEditorDecorationType, decs: vscode.DecorationOptions[]) {
    if (type) {
      for (const ed of this.editors) {
        if (isDisposable(ed) && !ed._disposed) {
          ed.setDecorations(type, decs);
        }
      }
    }
  }

  /**
   * Shutdown results manager
   */
  dispose() {
    this.editors.clear();

    for (const l of ['suite', 'test'] as const) {
      for (const e of Object.values(this.results[l])) {
        for (const x of Object.values(e.styles)) { x.dispose(); }
        if (l === 'test') {
          for (const x of Object.values((e as TestState).assertStyles)) {
            x.dispose();
          }
        }
      }
    }
  }

  refreshTest(test: TestState | string) {
    if (typeof test === 'string') {
      test = this.results.test[test];
    }
    if (test.decoration && test.status) {
      this.setStyle(test.styles[test.status], [test.decoration]);

      const out: Record<StatusUnknown, vscode.DecorationOptions[]> = { passed: [], failed: [], unknown: [], skipped: [] };
      for (const asrt of test.assertions) {
        out[asrt.status].push(asrt.decoration);
      }
      for (const k of Object.keys(out) as StatusUnknown[]) {
        this.setStyle(test.assertStyles[k], out[k]);
      }
    }
  }

  /**
   * Refresh all results
   */
  refresh() {
    for (const suite of Object.values(this.results.suite)) {
      if (suite.decoration && suite.status) {
        this.setStyle(suite.styles[suite.status], [suite.decoration]);
      }
    }
    for (const test of Object.values(this.results.test)) {
      this.refreshTest(test);
    }
  }

  /**
   * Refresh global diagnostics
   */
  refreshDiagnostics() {
    let document = this.document;

    this.diagnostics = Object.values(this.results.test)
      .filter(x => x.status === 'failed')
      .reduce((acc, ts) => {
        for (const as of ts.assertions) {
          if (as.status !== 'failed' || as.src.classId === 'unknown') {
            continue;
          }
          const { bodyFirst } = Decorations.buildErrorHover(as.src as ErrorHoverAssertion);
          const rng = as.decoration!.range;

          if (!document) {
            const content = fs.readFileSync(this.file, 'utf8');
            const self = {
              lines: content.split(/\n/g),
              lineAt(line: number) {
                return {
                  firstNonWhitespaceCharacterIndex: (self.lines[line].length - self.lines[line].trimLeft().length)
                };
              }
            };
            // @ts-ignore
            document = self as vscode.TextDocument;
          }

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
        return acc;
      }, [] as vscode.Diagnostic[]);
    diagColl.set(vscode.Uri.file(this.file), this.diagnostics);
  }

  /**
   * Store results information
   * @param level The level of the results
   * @param key The test key
   * @param status The status
   * @param decoration UI Decoration
   * @param src
   */
  store(level: Level, key: string, status: StatusUnknown, decoration: vscode.DecorationOptions, src?: any) {
    switch (level) {
      case 'assertion': {
        const el = this.results.test[key];
        const groups: Record<StatusUnknown, vscode.DecorationOptions[]> = { passed: [], failed: [], unknown: [], skipped: [] };

        el.assertions.push({ status, decoration, src });

        for (const a of el.assertions) {
          groups[a.status].push(a.decoration);
        }

        for (const s of ['passed', 'failed', 'unknown'] as const) {
          this.setStyle(el.assertStyles[s], groups[s]);
        }
        break;
      }
      case 'suite': {
        const el = this.results.suite[key];
        el.src = src;
        el.status = status;
        el.decoration = decoration;

        Object.keys(el.styles).forEach(x => {
          this.setStyle(el.styles[x], x === status ? [decoration] : []);
        });
        break;
      }
      case 'test': {
        const el = this.results.test[key];
        el.src = src;
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
  genStyles(level: Level) {
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
  reset(level: Exclude<Level, 'assertion'>, key: string) {
    const existing = this.results[level][key];
    const base: ResultState<any> = {
      status: 'unknown',
      styles: this.genStyles(level),
      src: (existing && existing.src)
    };

    if (existing) {
      Object.values(existing.styles).forEach(x => x.dispose());
      if (level === 'test') {
        Object.values((existing as TestState).assertStyles).forEach(x => x.dispose());
      }
    }
    switch (level) {
      case 'test': {
        const testBase = (base as TestState);
        testBase.assertions = [];
        testBase.assertStyles = this.genStyles('assertion');
        this.results[level][key] = testBase;
        break;
      }
      case 'suite': {
        const suiteBase = (base as SuiteState);
        this.results[level][key] = suiteBase;
        break;
      }
    }
  }

  /**
   * On suite results
   * @param suite
   */
  onSuite(suite: SuiteResult) {
    const status = suite.skipped ? 'unknown' : (suite.failed ? 'failed' : 'passed');
    this.reset('suite', suite.classId);
    this.store('suite', suite.classId, status, Decorations.buildSuite(suite), suite);
  }

  /**
   * On test results
   * @param test
   */
  onTest(test: TestResult) {
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
  onAssertion(assertion: Assertion) {
    const status = assertion.error ? 'failed' : 'passed';
    const key = `${assertion.classId}:${assertion.methodName}`;
    const dec = Decorations.buildAssertion(assertion);
    if (status === 'failed') {
      this.failedAssertions[Decorations.line(assertion.line).range.start.line] = assertion;
    }
    this.store('assertion', key, status, dec, assertion);
  }

  /**
   * On a test event, update internal state
   */
  onEvent(e: TestEvent | RemoveEvent) {
    if (e.type === 'removeTest') {
      this.reset('test', `${e.classId}:${e.method}`);
    } else if (e.phase === 'before') {
      switch (e.type) {
        case 'suite': {
          this.reset('suite', e.suite.classId);
          this.store('suite', e.suite.classId, 'unknown', Decorations.buildSuite(e.suite), e.suite);

          for (const test of Object.values(this.results.test).filter(x => x.src.classId === e.suite.classId)) {
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
  getTotals() {
    const vals = Object.values(this.results.test);
    const total = vals.length;
    let passed = 0;
    let unknown = 0;
    let failed = 0;
    let skipped = 0;

    for (const o of vals) {
      switch (o.status) {
        case 'skipped': skipped += 1; break;
        case 'failed': failed++; break;
        case 'passed': passed++; break;
        default: unknown++; break;
      }
    }

    return { passed, unknown, skipped, failed, total };
  }
}
