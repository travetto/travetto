import vscode from 'vscode';

import type { TestWatchEvent } from '@travetto/test';

import { Log } from '../../../core/log.ts';
import { Workspace } from '../../../core/workspace.ts';

import { DocumentResultsManager } from './document.ts';
import { DiagnosticManager } from './diagnostic.ts';

/**
 * Manages results for the entire workspace, including the statusbar
 */
export class WorkspaceResultsManager {
  #results = new Map<vscode.TextDocument, DocumentResultsManager>();
  #filenameMap = new Map<string, vscode.TextDocument>();
  #log: Log;
  #diagnostics: DiagnosticManager;
  #active?: [vscode.TextEditor, vscode.TextDocument];

  constructor(log: Log, window: typeof vscode.window) {
    this.#log = log;
    this.#diagnostics = new DiagnosticManager(window);
  }

  openDocument(document: vscode.TextDocument) {
    this.#filenameMap.set(document.fileName, document);
    this.getResults(document)?.refresh();
  }

  /**
   * Get test results
   * @param target
   */
  getLocation(target: vscode.TextDocument | TestWatchEvent | string): string | undefined {
    if (typeof target === 'string') {
      return Workspace.resolveManifestFileFromImport(target);
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
   * @param document
   */
  getResults(document: vscode.TextDocument): DocumentResultsManager | undefined {
    if (document && !this.#results.has(document)) {
      const rm = new DocumentResultsManager(document);
      this.#filenameMap.set(document.fileName, document);
      this.#log.debug('File is active', { file: document.fileName });
      this.#results.set(document, rm);
      if (vscode.window.activeTextEditor?.document === document) {
        rm.editor = vscode.window.activeTextEditor;
      }
    }

    return this.#results.get(document!)!;
  }

  /**
   * On test event
   * @param ev
   */
  onEvent(ev: TestWatchEvent): void {
    const file = this.getLocation(ev);
    if (file) {
      const document = this.#filenameMap.get(file);
      if (document) {
        this.#results.get(document)?.onEvent(ev);
      }
    }
    this.#diagnostics.onEvent(ev);
  }

  /**
   * Reset all
   */
  resetAll(): void {
    // Remove all state
    const entries = [...this.#results.entries()];
    this.#results.clear();
    this.#diagnostics.reset();
    for (const [, v] of entries) {
      v.dispose();
    }
  }

  /**
   * Start tracking an editor
   */
  setEditor(editor?: vscode.TextEditor): boolean {
    // Unset editor
    if (this.#active) {
      const results = this.getResults(this.#active[1]);
      if (results && results.editor !== editor) {
        results.editor = undefined;
      }
      this.#active = undefined;
    }

    // Bind to new value
    if (editor?.document) {
      this.#active = [editor, editor.document];

      try {
        const results = this.getResults(editor.document);
        if (results) {
          results.editor = editor;
          this.#log.info('Tracking', editor.document.fileName);
          return results.getListOfTests().length > 0;
        }
      } catch (error) {
        if (error instanceof Error) {
          this.#log.error(error.message, error);
        } else {
          throw error;
        }
      }
    }
    return false;
  }

  /**
   * Stop tracking
   */
  reset(document: vscode.TextDocument): void {
    if (this.#results.has(document)) {
      this.#log.debug('File is freed', { file: document.fileName });
      this.#results.get(document)?.dispose();
      this.#results.delete(document);
      this.#filenameMap.delete(document.fileName);
    }
    this.#diagnostics.clear(document.fileName);
  }
}