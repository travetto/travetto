import * as vscode from 'vscode';
import { FsUtil, PathUtil, ExecUtil, ExecutionOptions } from '@travetto/boot';

type ForkResult = ReturnType<(typeof ExecUtil)['forkMain']>;

/**
 * Standard set of workspace utilities
 */
export class Workspace {

  static readonly context: vscode.ExtensionContext;
  static readonly folder: vscode.WorkspaceFolder;

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
    // @ts-expect-error
    this.context = context;
    // @ts-expect-error
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
    return PathUtil.resolveFrameworkPath(PathUtil.resolveUnix(this.path, ...p));
  }

  /**
   * Run a main script
   */
  static runMain(main: string, args?: string[], opts?: ExecutionOptions & { format: undefined }): ForkResult;
  static runMain(main: string, args: string[], opts: ExecutionOptions & { format: 'raw' }): ForkResult;
  static runMain<T>(main: string, args: string[], opts: ExecutionOptions & { format: 'json' }): Promise<T>;
  static runMain(main: string, args: string[], opts: ExecutionOptions & { format: 'text' }): Promise<string>;
  static runMain(main: string, args: string[] = [], opts: ExecutionOptions & { format?: string } = {}): Promise<string | object> | ForkResult {
    const boot = this.resolve(`node_modules/${this.binPath('boot', 'main')}`);
    // Do not run inside of electron
    const exec = ExecUtil.spawn('node', [boot, main, ...args], {
      cwd: Workspace.path,
      ...opts,
      env: {
        NODE_PATH: PathUtil.resolveUnix('..', '..', '.bin'),
        ...(opts.env ?? {}),
      }
    });
    switch (opts.format) {
      case 'text': return exec.result.then(r => r.stdout);
      case 'json': return exec.result.then(r => JSON.parse(r.stdout));
      default: return exec;
    }
  }

  /**
   * Get a bin path for a module
   */
  static binPath(module: string, script: string) {
    return `@travetto/${module}/bin/${script}`;
  }

  /**
   * Build workspace code
   */
  static async buildCode() {
    const { result } = await this.runMain(this.binPath('base', 'build'));

    try {
      return await Promise.race([result, new Promise((res, rej) => setTimeout(rej, 500))]);
    } catch (err) { // Handle timeout
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Building...',
        cancellable: false
      }, () => result);
      return (await result).stdout;
    }
  }

  /**
   * See if module is installed
   * @param module
   */
  static async isInstalled(module: string) {
    return !!(await FsUtil.exists(this.resolve('node_modules', module)));
  }

  /**
   * Generate execution launch config
   * @param config
   */
  static generateLaunchConfig(name: string, main: string, args: string[] = []) {
    return {
      type: 'pwa-node',
      request: 'launch',
      protocol: 'inspector',
      // eslint-disable-next-line no-template-curly-in-string
      cwd: '${workspaceFolder}',
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
        'node:internals/**',
        'internal/**',
        '**/@travetto/context/**/*',
        '**/@travetto/watch/**/*',
        '**/@travetto/rest/src/util/route.ts',
        '**/@travetto/**/internal/*',
        '**/tslib/**/*'
      ],
      console: 'internalConsole',
      internalConsoleOptions: 'openOnSessionStart',
      name,
      program: this.resolve(`node_modules/${this.binPath('boot', 'main')}`),
      // eslint-disable-next-line no-template-curly-in-string
      args: [main.replace(this.path, '${workspaceFolder}'), ...args].map(x => `${x}`),
      env: {
        FORCE_COLOR: 'true'
      } as Record<string, string>
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