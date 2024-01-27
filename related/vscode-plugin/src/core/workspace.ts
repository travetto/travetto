import vscode from 'vscode';
import timers from 'node:timers/promises';

import type { CompilerStateType } from '@travetto/compiler/support/types';
import { ManifestContext, ManifestIndex, ManifestUtil, PackageUtil } from '@travetto/manifest';

/**
 * Standard set of workspace utilities
 */
export class Workspace {

  static #context: vscode.ExtensionContext;
  static #manifestContext: ManifestContext;
  static #workspaceIndex: ManifestIndex;
  static #compilerState: CompilerStateType | undefined;
  static #compilerStateListeners: ((ev: CompilerStateType | 'disconnected') => void)[] = [];

  static onCompilerState(handler: (ev: CompilerStateType | 'disconnected') => void): void {
    this.#compilerStateListeners.push(handler);
    handler(this.compilerState);
  }

  static set compilerState(state: CompilerStateType | undefined) {
    this.#compilerState = state;
    for (const el of this.#compilerStateListeners) { el(this.compilerState); }
  }

  /** Get the current compiler state */
  static get compilerState(): CompilerStateType | 'disconnected' {
    return this.#compilerState ?? 'disconnected';
  }

  static get isCompilerWatching(): boolean {
    return this.#compilerState === 'watch-start';
  }

  /** Resolve an import to a file path */
  static resolveImport(imp: string): string {
    return PackageUtil.resolveImport(imp, this.path);
  }

  /** Get workspace output folder */
  static get outputFolder(): string {
    return this.#manifestContext.build.outputFolder;
  }

  /** Get workspace uri */
  static get uri(): vscode.Uri {
    return vscode.Uri.file(this.path);
  }

  /** Get workspace path */
  static get path(): string {
    return this.#manifestContext.workspace.path;
  }

  /** Get workspace module */
  static get moduleName(): string {
    return this.#manifestContext.workspace.name;
  }

  /** Get workspace index */
  static get workspaceIndex(): ManifestIndex {
    return this.#workspaceIndex ??= new ManifestIndex(ManifestUtil.getManifestLocation(this.#manifestContext));
  }

  /**
   * Initialize extension context
   * @param context
   */
  static async init(context: vscode.ExtensionContext, manifestContext: ManifestContext): Promise<void> {
    this.#context = context;
    this.#manifestContext = manifestContext;
  }

  /** Find full path for a resource */
  static getAbsoluteResource(rel: string): string {
    return this.#context.asAbsolutePath(rel);
  }

  /** See if an entity is an editor */
  static isEditor(o: unknown): o is vscode.TextEditor {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return !!o && 'document' in (o as object);
  }

  /** Get the editor for a doc */
  static getEditor(doc: vscode.TextDocument): vscode.TextEditor | undefined {
    for (const e of vscode.window.visibleTextEditors) {
      if (e.document === doc) {
        return e;
      }
    }
  }

  static getDocumentEditor(editor?: vscode.TextEditor | vscode.TextDocument): vscode.TextEditor | undefined {
    editor = editor && !this.isEditor(editor) ? this.getEditor(editor) : editor;
    if (editor && editor.document) {
      return editor;
    }
  }

  /** Show a message for a limited time, with the ability to dismiss */
  static async showEphemeralMessage(text: string, duration = 3000): Promise<void> {
    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification, title: text, cancellable: true,
    }, async (_, token) => {
      const ctrl = new AbortController();
      token.onCancellationRequested(() => ctrl.abort());
      await timers.setTimeout(duration, undefined, { signal: ctrl.signal });
    });
  }
}