import vscode from 'vscode';

import { ManifestContext, PackageUtil } from '@travetto/manifest';

/**
 * Standard set of workspace utilities
 */
export class Workspace {

  static #context: vscode.ExtensionContext;
  static #manifestContext: ManifestContext;

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
}