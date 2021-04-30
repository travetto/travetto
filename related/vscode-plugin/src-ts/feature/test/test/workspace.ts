import * as vscode from 'vscode';

import { Workspace } from '../../../core/workspace';

import { DocumentResultsManager } from './document';
import { TestEvent, StatusUnknown, RemoveEvent, CompleteEvent } from './types';

/**
 * Manages results for the entire workspace, including the statusbar
 */
export class WorkspaceResultsManager {
  #status: vscode.StatusBarItem;
  #results: Map<string, DocumentResultsManager> = new Map();
  #window: typeof vscode.window;

  constructor(window: typeof vscode.window) {
    this.#window = window;
    this.#status = this.#window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.#status.command = 'workbench.action.showErrorsWarnings';
  }

  /**
   * Get totals from the runner
   */
  getTotals() {
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
  setStatus(message: string, color?: string) {
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
  getLocation(target: vscode.TextDocument | RemoveEvent | TestEvent) {
    let file: string | undefined;
    if ('fileName' in target) {
      file = target.fileName;
    } else if ('file' in target) {
      file = target.file;
    } else {
      switch (target.type) {
        case 'test': file = target.test.file; break;
        case 'suite': file = target.suite.file; break;
        case 'assertion': file = target.assertion.file; break;
      }
    }

    if (file) {
      return Workspace.resolve(file);
    }
  }

  /**
   * Get test results
   * @param target
   */
  getResults(target: vscode.TextDocument | RemoveEvent | TestEvent) {
    const file = this.getLocation(target);
    if (file) {
      if (!this.#results.has(file)) {
        const rm = new DocumentResultsManager(file);
        console.debug('Generating results manager', { file });
        this.#results.set(file, rm);
      }
      return this.#results.get(file)!;
    }
  }

  /**
   * On test event
   * @param ev
   */
  onEvent(ev: TestEvent | RemoveEvent | CompleteEvent) {
    if (ev.type === 'runComplete') {
      if (ev.error) {
        console.error(ev.error.name, ev.error.stack);
      }
    } else {
      this.getResults(ev)?.onEvent(ev);
      const totals = this.getTotals();
      this.setStatus(
        totals.failed === 0 ?
          `Passed ${totals.passed}` :
          `Failed ${totals.failed}/${totals.failed + totals.passed}`,
        totals.failed ? '#f33' : '#8f8'
      );
    }
  }

  /**
   * Stop runner
   */
  async dispose() {
    // Remove all state
    this.setStatus('');
    const entries = [...this.#results.entries()];
    this.#results.clear();
    for (const [, v] of entries) {
      v.dispose();
    }
  }

  /**
   * Start tracking an editor
   */
  trackEditor(editor: vscode.TextEditor | vscode.TextDocument | undefined) {
    editor = Workspace.getDocumentEditor(editor);
    if (editor && editor.document) {
      this.getResults(editor.document)?.addEditor(editor);
    }
  }

  /**
   * Stop tracking
   */
  async untrackEditor(editor: vscode.TextEditor | vscode.TextDocument | undefined) {
    editor = Workspace.getDocumentEditor(editor);
    if (editor) {
      if (this.#results.has(editor.document.fileName)) {
        this.#results.get(editor.document.fileName)!.dispose();
      }
    }
  }
}