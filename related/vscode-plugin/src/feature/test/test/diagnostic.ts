import vscode from 'vscode';

import type { SuiteResult, TestRemoveEvent, TestResult, TestWatchEvent } from '@travetto/test';

import { Workspace } from '../../../core/workspace';
import { Decorations } from './decoration';

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
    const clsName = test.classId.split(/[^a-z-/]+/i).pop();
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

  afterSuite(suite: SuiteResult): void {
    switch (suite.status) {
      case 'passed': this.setStatus(`Passed ${suite.passed}/${suite.total}`, '#8f8'); break;
      case 'failed': this.setStatus(`Failed ${suite.failed}/${suite.total}`, '#f33'); break;
      default: this.setStatus(`${suite.status}`);
    }
  }

  afterTest(test: TestResult): void {
    const file = Workspace.resolveImport(test.import);
    if (!this.#tracked.has(file)) {
      this.#tracked.set(file, new Map());
    }
    if (!this.#tracked.get(file)!.has(test.classId)) {
      this.#tracked.get(file)!.set(test.classId, new Map());
    }
    this.#tracked.get(file)!.get(test.classId)!.set(test.methodName, test);
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
      this.afterSuite(event.suite);
    } else if (event.type === 'test' && event.phase === 'after') {
      this.afterTest(event.test);
    } else if (event.type === 'removeTest') {
      this.onTestRemove(event);
    }
  }

  resetFile(file: string): void {
    this.#tracked.delete(file);
    this.#setDiagnostics(file);
  }

  reset(): void {
    testDiagnostics.clear();
    this.setStatus('');
    this.#tracked.clear();
  }

  /**
   * Set overall status
   * @param message
   * @param color
   */
  setStatus(message: string, color?: string): void {
    if (!message) {
      this.#status.hide();
    } else {
      this.#status.color = color || '#fff';
      this.#status.text = message;
      this.#status.show();
    }
  }
}