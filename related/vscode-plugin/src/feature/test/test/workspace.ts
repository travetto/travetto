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
   * Get test import location
   */
  getImport(target: vscode.TextDocument | vscode.TextEditor | TestWatchEvent): string {
    if ('document' in target) {
      return this.getImport(target.document);
    } else if ('fileName' in target) {
      return Workspace.workspaceIndex.findImportForArbitraryFile(target.fileName)!;
    } else if ('import' in target) {
      return target.import;
    } else {
      switch (target.type) {
        case 'test': return target.test.import;
        case 'suite': return target.suite.import;
        case 'assertion': return target.assertion.import;
        default: throw new Error('Unknown target');
      }
    }
  }

  /**
   * Get test uri
   */
  getUri(target: vscode.TextDocument | vscode.TextEditor | TestWatchEvent | string): vscode.Uri {
    if (typeof target === 'string') {
      return vscode.Uri.file(Workspace.workspaceIndex.getFromImport(target)!.sourceFile);
    } else if ('document' in target) {
      return this.getUri(target.document);
    } else if ('fileName' in target) {
      return target.uri;
    } else if ('import' in target) {
      return this.getUri(target.import);
    } else {
      switch (target.type) {
        case 'test': return this.getUri(target.test.import);
        case 'suite': return this.getUri(target.suite.import);
        case 'assertion': return this.getUri(target.assertion.import);
        default: throw new Error('Unknown target');
      }
    }
  }

  /**
   * Get test results
   * @param target
   */
  getResults(target: vscode.TextDocument | TestWatchEvent): DocumentResultsManager | undefined {
    const imp = this.getImport(target);
    if (imp) {
      if (!this.#results.has(imp)) {
        const rm = new DocumentResultsManager(imp, this.getUri(target)!);
        this.#log.debug('Generating results manager', { imp });
        this.#results.set(imp, rm);
      }
      return this.#results.get(imp)!;
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
  }

  /**
   * Start tracking an editor
   */
  trackEditor(editor: vscode.TextEditor | vscode.TextDocument | undefined): void {
    editor = Workspace.getDocumentEditor(editor);
    if (editor && editor.document) {
      try {
        this.getResults(editor.document)?.addEditor(editor);
        this.#log.info('Tracking', this.getImport(editor.document));
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
    if (editor) {
      const imp = this.getImport(editor.document);
      if (imp && this.#results.has(imp)) {
        this.#results.get(imp)!.dispose();
        this.#results.delete(imp);
        this.#log.info('Untracking', imp);
      }
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