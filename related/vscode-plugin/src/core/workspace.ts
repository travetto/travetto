import vscode from 'vscode';

import { ManifestIndex } from '@travetto/manifest';
import { CliLaunchConfig, LaunchConfig } from './types';

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
      config.main = this.workspaceIndex.resolveFileImport('@travetto/compiler/bin/trv');
      Object.assign(config.env ??= {}, {
        TRV_MANIFEST: config.cliModule ?? '',
        TRV_DYNAMIC: '1',
        TRV_OUTPUT: [Workspace.path, Workspace.workspaceIndex.manifest.outputFolder].join('/'),
      });
    }

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
      outFiles: [
        ['${workspaceFolder}', this.workspaceIndex.manifest.outputFolder, '**', '*.js'].join('/')
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
        '**/@travetto/rest/src/util/route.ts',
        '**/@travetto/**/internal/*',
        '**/tslib/**/*'
      ],
      console: 'internalConsole',
      internalConsoleOptions: 'openOnSessionStart',
      name: config.name,
      program: this.workspaceIndex.manifest.workspacePath,
      // eslint-disable-next-line no-template-curly-in-string
      args: [config.main.replace(this.path, '${workspaceFolder}'), ...config.args ?? []].map(x => `${x}`),
      env: { FORCE_COLOR: 'true', ...config.env }
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