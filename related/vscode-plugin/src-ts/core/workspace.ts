import * as vscode from 'vscode';
import { FsUtil, PathUtil, Package } from '@travetto/boot';

/**
 * Standard set of workspace utilities
 */
export class Workspace {

  static _module: string;
  static context: vscode.ExtensionContext;
  static folder: vscode.WorkspaceFolder;

  /**
   * Get workspace path
   */
  static get path() {
    return this.folder.uri.fsPath;
  }

  /**
   * Read default environment data for executions
   * @param extra Additional env vars to add
   */
  static getDefaultEnv(extra: Record<string, string> = {}) {
    return {
      FORCE_COLOR: 'true',
      ...extra
    };
  }

  /**
   * Initialize extension context
   * @param context
   */
  static init(context: vscode.ExtensionContext) {
    this.context = context;
    [this.folder] = vscode.workspace.workspaceFolders!;
    Object.defineProperty(PathUtil, 'cwd', { value: Workspace.path });
  }

  /**
   * Find full path for a resource
   * @param rel
   */
  static getAbsoluteResource(rel: string) {
    return this.context.asAbsolutePath(rel);
  }

  /**
   * Resolve worskapce path
   */
  static resolve(...p: string[]) {
    return PathUtil.resolveUnix(this.path, ...p);
  }

  /**
   * Get module
   */
  static getModule() {
    if (this._module === undefined) {
      this._module = Package.name ?? '';
    }
    return this._module;
  }

  /**
   * See if module is installed
   * @param module
   */
  static async isInstalled(module: string) {
    return !!(await FsUtil.exists(this.resolve('node_modules', module))) || this.getModule() === module;
  }

  /**
   * Generate execution launch config
   * @param config
   */
  static generateLaunchConfig(config: { name: string, program: string } & Partial<vscode.DebugConfiguration>) {
    // eslint-disable-next-line no-template-curly-in-string
    config.program = config.program.replace(this.path, '${workspaceFolder}');
    return {
      type: 'node',
      request: 'launch',
      protocol: 'inspector',
      // eslint-disable-next-line no-template-curly-in-string
      cwd: '${workspaceFolder}',
      stopOnEntry: true,
      sourceMaps: true,
      runtimeArgs: [
        '--nolazy'
      ],
      resolveSourceMapLocations: [
        '!**/node_modules/typescript/**'
      ],
      breakOnLoadStrategy: 'regex',
      skipFiles: [
        '<node_internals>/**',
        '**/@travetto/context/**/*',
        '**/@travetto/watch/**/*',
        '**/@travetto/**/internal/*',
        '**/tslib/**/*'
      ],
      console: 'internalConsole',
      internalConsoleOptions: 'openOnSessionStart',
      ...config
    };
  }

  /**
   * See if an entity is an editor
   * @param o
   */
  static isEditor(o: unknown): o is vscode.TextEditor {
    return !!o && 'document' in (o as object);
  }

  /**
   * Get the editor for a doc
   * @param doc
   */
  static getEditor(doc: vscode.TextDocument) {
    for (const e of vscode.window.visibleTextEditors) {
      if (e.document === doc) {
        return e;
      }
    }
  }

  static getDocumentEditor(editor?: vscode.TextEditor | vscode.TextDocument) {
    editor = editor && !this.isEditor(editor) ? this.getEditor(editor) : editor;
    if (editor && editor.document) {
      return editor;
    }
  }

  static addBreakpoint(editor: vscode.TextEditor, line: number) {
    const uri = editor.document.uri;
    const pos = new vscode.Position(line - 1, 0);
    const loc = new vscode.Location(uri, pos);
    const breakpoint = new vscode.SourceBreakpoint(loc, true);
    vscode.debug.addBreakpoints([breakpoint]);

    const remove = vscode.debug.onDidTerminateDebugSession(() => {
      vscode.debug.removeBreakpoints([breakpoint]);
      remove.dispose();
    });
  }
}