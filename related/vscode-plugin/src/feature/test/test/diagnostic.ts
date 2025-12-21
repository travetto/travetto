import vscode from 'vscode';

import type { TestResult, TestWatchEvent } from '@travetto/test';

import { Workspace } from '../../../core/workspace';
import { Decorations } from './decoration';

export const testDiagnostics = vscode.languages.createDiagnosticCollection('Travetto');

/**
 * Manages global diagnostic error messages
 */
export class DiagnosticManager {
  #status: vscode.StatusBarItem;
  #tracked = new Map<string, Map<string, TestResult>>();
  #window: typeof vscode.window;

  constructor(window: typeof vscode.window) {
    this.#window = window;
    this.#status = this.#window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.#status.command = 'workbench.action.showErrorsWarnings';
  }

  #buildDiagnostics(file: string) {
    const results = this.#tracked.get(file)!;
    const diagnostics: vscode.Diagnostic[] = [];
    for (const test of results.values()) {
      if (test.status !== 'failed') {
        continue;
      }
      const clsName = test.classId.split(/[^a-z-/]+/i).pop();
      const addError = (msg: string, line: number) => {
        const diag = new vscode.Diagnostic(
          new vscode.Range(new vscode.Position(line - 1, 0), new vscode.Position(line - 1, 1000)),
          `${clsName}.${test.methodName} - ${msg}`,
          vscode.DiagnosticSeverity.Error
        );
        diag.source = '@travetto/test';
        diagnostics.push(diag);
      };

      for (const as of test.assertions) {
        if (!as.error) {
          continue;
        }
        addError(Decorations.buildErrorHover(as).bodyFirst, as.line);
      }

      if (test.assertions.length === 0) {
        if ('error' in test && test.error) {
          const firstLine = test.error.message.split(/\n/).shift();
          Workspace.resolveManifestIndexFileFromFile(file);
          const { outputFile } = Workspace.workspaceIndex.getFromSource(file) ?? {};
          if (!outputFile || !firstLine) {
            continue;
          }
          if (!firstLine.startsWith('Cannot find module') || !firstLine.includes(outputFile)) {
            addError(firstLine, test.lineStart);
          }
        }
      }
    }

    testDiagnostics.set(vscode.Uri.file(file), diagnostics);
  }

  clear(file: string): void {
    if (this.#tracked.has(file)) {
      this.#tracked.set(file, new Map());
      this.#buildDiagnostics(file);
    }
    this.setStatus('');
  }

  rename(oldFile: string, newFile: string): void {
    this.clear(oldFile);
  }

  onEvent(event: TestWatchEvent): void {
    if (event.type === 'suite' && event.phase === 'after') {
      const { suite } = event;
      this.setStatus(
        suite.failed === 0 ?
          `Passed ${suite.passed}` :
          `suite.Failed ${suite.failed}/${suite.failed + suite.passed}`,
        suite.failed ? '#f33' : '#8f8'
      );
    } else if (event.type === 'test' && event.phase === 'after') {
      const file = Workspace.resolveImport(event.test.import);
      if (!this.#tracked.has(file)) {
        this.#tracked.set(file, new Map());
      }
      this.#tracked.get(file)!.set(`${event.test.classId}:${event.test.methodName}`, event.test);
      this.#buildDiagnostics(file);
    } else if (event.type === 'removeTest') {
      const file = Workspace.resolveImport(event.import);
      if (!this.#tracked.has(file)) {
        this.#tracked.set(file, new Map());
      }
      if ('methodName' in event) {
        const tests = [...this.#tracked.get(file)!.values()];
        const idx = tests.findIndex(result => result.methodName === event.methodName);
        if (idx >= 0) {
          tests.splice(idx, 1);
        }
        this.#buildDiagnostics(file);
      } else if (event.classId) {
        this.#tracked.get(file)!.delete(event.classId);
        this.#buildDiagnostics(file);
      } else {
        this.#tracked.set(file, new Map());
        this.#buildDiagnostics(file);
      }
    }
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