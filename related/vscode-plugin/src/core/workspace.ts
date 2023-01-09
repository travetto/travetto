import vscode from 'vscode';

import { ExecUtil, ExecutionOptions, ExecutionState } from '@travetto/base';
import { ManifestIndex, path } from '@travetto/manifest';

import { LaunchConfig } from './types';

/**
 * Standard set of workspace utilities
 */
export class Workspace {

  static readonly context: vscode.ExtensionContext;
  static readonly folder: vscode.WorkspaceFolder;
  static readonly extensionIndex: ManifestIndex;
  static readonly workspaceIndex: ManifestIndex;

  /**
   * Get workspace path
   */
  static get path(): string {
    return this.workspaceIndex.manifest.workspacePath;
  }

  /**
   * Get workspace uri
   */
  static get uri(): vscode.Uri {
    return vscode.Uri.file(this.path);
  }

  /**
   * Read default environment data for executions
   * @param extra Additional env vars to add
   */
  static getDefaultEnv(extra: Record<string, string> = {}): Record<string, string> {
    return { FORCE_COLOR: 'true', ...extra };
  }

  /**
   * Initialize extension context
   * @param context
   */
  static async init(
    context: vscode.ExtensionContext,
    extensionIndex: ManifestIndex,
    workspaceIndex: ManifestIndex
  ): Promise<void> {
    // @ts-expect-error
    this.context = context;
    // @ts-expect-error
    this.extensionIndex = extensionIndex;
    // @ts-expect-error
    this.workspaceIndex = workspaceIndex;

    for (const ext of this.extensionIndex.findSrc({
      filter: f => /.*\/feature.*?\/main[.]/.test(f)
    })) {
      await import(ext.output);
    }
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
   * See if module is installed
   * @param module
   */
  static async isInstalled(module: string): Promise<boolean> {
    return this.workspaceIndex.hasModule(module);
  }

  /**
   * Generate execution launch config
   * @param config
   */
  static generateLaunchConfig(config: LaunchConfig): vscode.DebugConfiguration {
    if (config.useCli) {
      config.args = [config.main, ...config.args ?? []];
      config.main = path.resolve(this.path, 'node_modules', '@travetto/compiler/bin/trv');
      Object.assign(config.env ??= {}, {
        TRV_MANIFEST: config.cliModule ?? '',
        TRV_OUTPUT: [Workspace.path, Workspace.workspaceIndex.manifest.outputFolder].join('/'),
      });
    }

    /* eslint-disable no-template-curly-in-string */
    const res: vscode.DebugConfiguration = {
      type: 'node',
      request: 'launch',
      protocol: 'inspector',
      cwd: '${workspaceFolder}',
      sourceMaps: true,
      outFiles: [
        ['${workspaceFolder}', this.workspaceIndex.manifest.outputFolder, '**', '*.js'].join('/'),
        ['${workspaceFolder}', this.workspaceIndex.manifest.compilerFolder, '**', '*.js'].join('/')
      ],
      resolveSourceMapLocations: [
        '!**/node_modules/typescript/**',
      ],
      skipFiles: [
        '<node_internals>/**',
        'node:internals/**',
        'internal/**',
        '**/@travetto/context/**/*',
        '**/@travetto/rest/src/util/route.ts',
        '**/@travetto/**/internal/*',
        '**/tslib/**/*'
      ],
      trace: true,
      pauseForSourceMap: true,
      console: 'internalConsole',
      internalConsoleOptions: 'openOnSessionStart',
      name: config.name,
      program: config.main.replace(this.path, '${workspaceFolder}'),
      args: (config.args ?? []).map(x => `${x}`),
      env: { FORCE_COLOR: '3', ...config.env }
    };
    /* eslint-enable no-template-curly-in-string */
    return res;
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

  static spawnCli(command: string, args?: string[], opts?: ExecutionOptions & { cliModule?: string }): ExecutionState {
    return ExecUtil.spawn(
      'npx',
      ['trv', command, ...args ?? []],
      {
        cwd: this.path,
        ...opts,
        env: {
          ...opts?.env,
          TRV_MANIFEST: opts?.cliModule ?? Workspace.workspaceIndex.manifest.mainModule,
          TRV_OUTPUT: [Workspace.path, Workspace.workspaceIndex.manifest.outputFolder].join('/'),
        }
      }
    )
  }
}