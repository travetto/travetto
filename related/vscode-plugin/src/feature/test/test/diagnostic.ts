import * as vscode from 'vscode';

import type { TestRemoveEvent, TestResult, TestStatus, TestWatchEvent } from '@travetto/test';

import { Workspace } from '../../../core/workspace.ts';
import { Decorations, Style } from './decoration.ts';

export const testDiagnostics = vscode.languages.createDiagnosticCollection('Travetto');

/**
 * Manages global diagnostic error messages
 */
export class DiagnosticManager {
  #status: vscode.StatusBarItem;
  #tracked = new Map<string, Map<string, Map<string, TestResult>>>();
  #window: typeof vscode.window;

  constructor(window: typeof vscode.window) {
    this.#window = window;
    this.#status = this.#window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.#status.command = 'workbench.action.showErrorsWarnings';
  }

  #buildTestDiagnostics(file: string, test: TestResult): vscode.Diagnostic[] {
    const clsName = test.classId.split(/[^a-z-/]+/i).at(-1);
    const results: vscode.Diagnostic[] = [];

    const addError = (msg: string, line: number) => {
      const item = new vscode.Diagnostic(
        new vscode.Range(new vscode.Position(line - 1, 0), new vscode.Position(line - 1, 1000)),
        `${clsName}.${test.methodName} - ${msg}`,
        vscode.DiagnosticSeverity.Error
      );
      item.source = '@travetto/test';
      results.push(item);
    };

    for (const assertion of test.assertions) {
      if (!assertion.error) {
        continue;
      }
      addError(Decorations.buildErrorHover(assertion).bodyFirst, assertion.line);
    }

    if (test.assertions.length === 0) {
      if ('error' in test && test.error) {
        const firstLine = test.error.message.split(/\n/).shift();
        Workspace.resolveManifestIndexFileFromFile(file);
        const { outputFile } = Workspace.workspaceIndex.getFromSource(file) ?? {};
        if (outputFile && firstLine && (!firstLine.startsWith('Cannot find module') || !firstLine.includes(outputFile))) {
          addError(firstLine, test.lineStart);
        }
      }
    }
    return results;
  }

  #setDiagnostics(file: string) {
    const classes = this.#tracked.get(file);

    const diagnostics = [...classes?.values() ?? []]
      .flatMap(m => [...m.values()])
      .filter(t => t.status === 'failed')
      .flatMap(t => this.#buildTestDiagnostics(file, t));

    testDiagnostics.set(vscode.Uri.file(file), diagnostics);
  }

  refreshStatus(): void {
    const { total, passed, failed, unknown } = [...this.#tracked.values()]
      .flatMap(m => [...m.values()])
      .flatMap(t => [...t.values()])
      .reduce((acc, t) => {
        acc.total += 1;
        acc[t.status] += 1;
        return acc;
      }, { total: 0, passed: 0, failed: 0, skipped: 0, unknown: 0 });

    const status = failed > 0 ? 'failed' : passed === total ? 'passed' : 'unknown';
    this.setStatus(`Tests \$(pass-filled) ${passed} \$(alert) ${failed}`, status);
  }

  afterTest(test: TestResult): void {
    const file = Workspace.resolveImport(test.import);
    this.#tracked.getOrInsert(file, new Map()).getOrInsert(test.classId, new Map()).set(test.methodName, test);
    this.#setDiagnostics(file);
  }

  onTestRemove(event: TestRemoveEvent): void {
    const file = Workspace.resolveImport(event.import);
    if (event.methodName && event.classId) {
      this.#tracked.get(file)?.get(event.classId)?.delete(event.methodName);
    } else if (event.classId) {
      this.#tracked.get(file)?.delete(event.classId);
    } else {
      this.#tracked.delete(file);
    }
    this.#setDiagnostics(file);
  }

  onEvent(event: TestWatchEvent): void {
    if (event.type === 'suite' && event.phase === 'after') {
      this.refreshStatus();
    } else if (event.type === 'test' && event.phase === 'after') {
      this.afterTest(event.test);
    } else if (event.type === 'removeTest') {
      this.onTestRemove(event);
    }
  }

  resetFile(file: string): void {
    this.#tracked.delete(file);
    this.#setDiagnostics(file);
    this.refreshStatus();
  }

  reset(): void {
    testDiagnostics.clear();
    this.setStatus('', 'unknown');
    this.#tracked.clear();
  }

  /**
   * Set overall status
   * @param message
   * @param status
   */
  setStatus(message: string, status: TestStatus): void {
    if (!message) {
      this.#status.hide();
      return;
    }

    switch (status) {
      case 'passed':
        this.#status.backgroundColor = undefined;
        this.#status.color = Style.COLORS.passed;
        break;
      case 'failed':
        this.#status.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        this.#status.color = new vscode.ThemeColor('statusBarItem.errorForeground');
        break;
      default:
        this.#status.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        this.#status.color = new vscode.ThemeColor('statusBarItem.warningForeground');
        break;
    }
    this.#status.text = message;
    this.#status.show();
  }
}