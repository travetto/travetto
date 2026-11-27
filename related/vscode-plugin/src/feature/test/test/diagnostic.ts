import * as vscode from 'vscode';

import type { TestRemoveEvent, TestResult, TestWatchEvent } from '@travetto/test';

import { Workspace } from '../../../core/workspace.ts';
import { Decorations } from './decoration.ts';

export const testDiagnostics = vscode.languages.createDiagnosticCollection('Travetto');

/**
 * Manages global diagnostic error messages
 */
export class DiagnosticManager {
  static build(test: TestResult, message: string, line: number): vscode.Diagnostic {
    const clsName = test.classId.split(/[^a-z-/]+/i).at(-1);
    const item = new vscode.Diagnostic(
      new vscode.Range(new vscode.Position(line - 1, 0), new vscode.Position(line - 1, 1000)),
      `${clsName}.${test.methodName} - ${message}`,
      vscode.DiagnosticSeverity.Error
    );
    item.source = '@travetto/test';
    return item;
  }

  #tracked = new Map<string, Map<string, Map<string, TestResult>>>();

  #buildTestDiagnostics(file: string, test: TestResult): vscode.Diagnostic[] {
    const results: vscode.Diagnostic[] = [];

    for (const assertion of test.assertions) {
      if (!assertion.error) {
        continue;
      }
      results.push(DiagnosticManager.build(test, Decorations.buildErrorHover(assertion).bodyFirst, assertion.line));
    }

    if (test.assertions.length === 0) {
      if ('error' in test && test.error) {
        const firstLine = test.error.message.split(/\n/).shift();
        Workspace.resolveManifestIndexFileFromFile(file);
        const { outputFile } = Workspace.workspaceIndex.getFromSource(file) ?? {};
        if (outputFile && firstLine && (!firstLine.startsWith('Cannot find module') || !firstLine.includes(outputFile))) {
          results.push(DiagnosticManager.build(test, firstLine, test.lineStart));
        }
      }
    }
    return results;
  }

  #setDiagnostics(file: string): void {
    const classes = this.#tracked.get(file);

    const diagnostics = [...(classes?.values() ?? [])]
      .flatMap(suite => [...suite.values()])
      .filter(test => test.status === 'failed' || test.status === 'errored')
      .flatMap(test => this.#buildTestDiagnostics(file, test));

    testDiagnostics.set(vscode.Uri.file(file), diagnostics);
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
    if (event.type === 'test' && event.phase === 'after') {
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
    this.#tracked.clear();
  }
}
