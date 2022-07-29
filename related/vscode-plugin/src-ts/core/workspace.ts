import * as vscode from 'vscode';
import { FsUtil, PathUtil, ExecUtil, ExecutionOptions, ExecutionResult } from '@travetto/boot';

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
  static get path(): string {
    return this.folder.uri.fsPath;
  }

  /**
   * Read default environment data for executions
   * @param extra Additional env vars to add
   */
  static getDefaultEnv(extra: Record<string, string> = {}): Record<string, string> {
    return {
      FORCE_COLOR: 'true',
      ...extra
    };
  }

  /**
   * Initialize extension context
   * @param context
   */
  static init(context: vscode.ExtensionContext): void {
    // @ts-expect-error
    this.context = context;
    // @ts-expect-error
    [this.folder] = vscode.workspace.workspaceFolders!;
    Object.defineProperty(PathUtil, 'cwd', { value: Workspace.path });
  }

  /**
   * Sleep
   * @param ms
   */
  static sleep(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
  }

  /**
   * Find full path for a resource
   * @param rel
   */
  static getAbsoluteResource(rel: string): string {
    return this.context.asAbsolutePath(rel);
  }

  /**
   * Resolve workspace path
   */
  static resolve(...p: string[]): string {
    return PathUtil.resolveFrameworkPath(PathUtil.resolveUnix(this.path, ...p));
  }

  /**
   * Resolve workspace path
   */
  static resolveModule(...p: string[]): string {
    return this.resolve('node_modules', ...p);
  }

  /**
   * Run a main script
   */
  static runMain(main: string, args?: string[], opts?: ExecutionOptions & { format: undefined }): ForkResult;
  static runMain(main: string, args: string[], opts: ExecutionOptions & { format: 'raw' }): ForkResult;
  static runMain<T>(main: string, args: string[], opts: ExecutionOptions & { format: 'json' }): Promise<T>;
  static runMain(main: string, args: string[], opts: ExecutionOptions & { format: 'text' }): Promise<string>;
  static runMain(main: string, args: string[] = [], opts: ExecutionOptions & { format?: string } = {}): Promise<string | object> | ForkResult {
    const boot = this.resolveModule(this.binPath('boot', 'main'));
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
  static binPath(module: string, script: string): string {
    return `@travetto/${module}/bin/${script}`;
  }

  /**
   * Build workspace code
   */
  static async buildCode(): Promise<ExecutionResult | string> {
    const { result } = await this.runMain(this.binPath('base', 'build'));

    try {
      return await Promise.race([result, this.sleep(500).then(() => { throw new Error(); })]);
    } catch { // Handle timeout
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
  static async isInstalled(module: string): Promise<boolean> {
    return !!(await FsUtil.exists(this.resolveModule(module)));
  }

  /**
   * Generate execution launch config
   * @param config
   */
  static generateLaunchConfig(name: string, main: string, args: string[] = [], env: Record<string, string> = {}): vscode.DebugConfiguration {
    return {
      type: 'node',
      request: 'launch',
      protocol: 'inspector',
      // eslint-disable-next-line no-template-curly-in-string
      cwd: '${workspaceFolder}',
      sourceMaps: true,
      runtimeArgs: [
        '--nolazy'
      ],
      resolveSourceMapLocations: [
        '!**/node_modules/typescript/**',
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
      program: this.resolveModule(this.binPath('boot', 'main')),
      // eslint-disable-next-line no-template-curly-in-string
      args: [main.replace(this.path, '${workspaceFolder}'), ...args].map(x => `${x}`),
      env: { FORCE_COLOR: 'true', ...env }
    } as const;
  }

  /**
   * See if an entity is an editor
   * @param o
   */
  static isEditor(o: unknown): o is vscode.TextEditor {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return !!o && 'document' in (o as object);
  }

  /**
   * Get the editor for a doc
   * @param doc
   */
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

  static addBreakpoint(editor: vscode.TextEditor, line: number): void {
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