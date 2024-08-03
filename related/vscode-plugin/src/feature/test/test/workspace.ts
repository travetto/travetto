import vscode from 'vscode';

import type { TestWatchEvent } from '@travetto/test/src/execute/watcher';

import { Log } from '../../../core/log';
import { Workspace } from '../../../core/workspace';

import { DocumentResultsManager } from './document';
import { StatusUnknown } from './types';

/**
 * Manages results for the entire workspace, including the statusbar
 */
export class WorkspaceResultsManager {
  #status: vscode.StatusBarItem;
  #results: Map<string, DocumentResultsManager> = new Map();
  #window: typeof vscode.window;
  #log: Log;

  constructor(log: Log, window: typeof vscode.window) {
    this.#log = log;
    this.#window = window;
    this.#status = this.#window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.#status.command = 'workbench.action.showErrorsWarnings';
  }

  /**
   * Get totals from the runner
   */
  getTotals(): Record<StatusUnknown, number> {
    const totals: Record<StatusUnknown, number> = {
      skipped: 0,
      failed: 0,
      passed: 0,
      unknown: 0
    };
    for (const mgr of this.#results.values()) {
      const test = mgr.getTotals();
      totals.skipped += test.skipped;
      totals.failed += test.failed;
      totals.passed += test.passed;
      totals.unknown += test.unknown;
    }
    return totals;
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

  /**
   * Get test results
   * @param target
   */
  getLocation(target: vscode.TextDocument | TestWatchEvent | string): string | undefined {
    if (typeof target === 'string') {
      return Workspace.resolveImport(target);
    } else if ('fileName' in target) {
      return target.fileName;
    } else if ('import' in target) {
      return this.getLocation(target.import);
    } else {
      switch (target.type) {
        case 'test': return this.getLocation(target.test.import);
        case 'suite': return this.getLocation(target.suite.import);
        case 'assertion': return this.getLocation(target.assertion.import);
      }
    }
  }

  /**
   * Get test results
   * @param target
   */
  getResults(target: vscode.TextDocument | TestWatchEvent): DocumentResultsManager | undefined {
    const file = this.getLocation(target);
    if (file) {
      if (!this.#results.has(file)) {
        const rm = new DocumentResultsManager(file);
        this.#log.debug('Generating results manager', { file });
        this.#results.set(file, rm);
      }
      return this.#results.get(file)!;
    }
  }

  updateTotals(): void {
    const totals = this.getTotals();
    this.setStatus(
      totals.failed === 0 ?
        `Passed ${totals.passed}` :
        `Failed ${totals.failed}/${totals.failed + totals.passed}`,
      totals.failed ? '#f33' : '#8f8'
    );
  }

  /**
   * On test event
   * @param ev
   */
  onEvent(ev: TestWatchEvent): void {
    this.getResults(ev)?.onEvent(ev);
    this.updateTotals();
  }

  /**
   * Reset all
   */
  resetAll(): void {
    // Remove all state
    this.setStatus('');
    const entries = [...this.#results.entries()];
    this.#results.clear();
    for (const [, v] of entries) {
      v.dispose();
    }
    // Clear out all diagnostics
    // testDiagnostics.clear();
  }

  /**
   * Start tracking an editor
   */
  trackEditor(editor: vscode.TextEditor | vscode.TextDocument | undefined): void {
    editor = Workspace.getDocumentEditor(editor);
    if (editor && editor.document) {
      try {
        this.getResults(editor.document)?.addEditor(editor);
        this.#log.info('Tracking', editor.document.fileName);
      } catch (err) {
        if (err instanceof Error) {
          this.#log.error(err.message, err);
        } else {
          throw err;
        }
      }
    }
  }

  /**
   * Stop tracking
   */
  untrackEditor(editor: vscode.TextEditor | vscode.TextDocument | undefined): void {
    editor = Workspace.getDocumentEditor(editor);
    if (editor && this.#results.has(editor.document.fileName)) {
      this.#results.get(editor.document.fileName)!.dispose();
      this.#results.delete(editor.document.fileName);
      this.#log.info('Untracking', editor.document.fileName);
    }
  }

  /**
   * Stop tracking
   */
  reset(editor: vscode.TextEditor | vscode.TextDocument | undefined): void {
    this.untrackEditor(editor);
    this.updateTotals();
    this.trackEditor(editor);
  }
}