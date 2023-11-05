import timers from 'timers/promises';
import vscode from 'vscode';
import { WorkerOptions } from 'worker_threads';
import module from 'module';

import { ExecUtil, ExecutionOptions, ExecutionState, WorkerResult } from '@travetto/base';
import { ManifestContext, ManifestIndex, path } from '@travetto/manifest';

import { EnvDict, LaunchConfig } from './types';
import { Log } from './log';

type MProm<T> = Promise<T> & { resolve: (val: T) => void, reject: (err?: Error) => void };

/**
 * Standard set of workspace utilities
 */
export class Workspace {

  static #baseEnv: EnvDict = {
    DEBUG: ''
  };

  static readonly context: vscode.ExtensionContext;
  static readonly folder: vscode.WorkspaceFolder;
  static #extensionIndex: ManifestIndex;
  static #manifestContext: ManifestContext;
  static #req: ReturnType<typeof module['createRequire']>;
  static #importToFile = new Map<string, string | undefined>();
  static #log = new Log('travetto.vscode.workspace');

  static get isMonoRepo(): boolean {
    return !!this.#manifestContext.monoRepo;
  }

  /**
   * Get workspace path
   */
  static get path(): string {
    return this.#manifestContext.workspacePath;
  }

  static compilerServerUrl(rel: string): string {
    return `${this.#manifestContext.compilerUrl}${rel}`;
  }

  static async getSourceFromImport(imp: string): Promise<string | undefined> {
    if (!this.#importToFile.has(imp)) {
      let file: undefined | string;
      if (imp.startsWith(this.#manifestContext.mainModule)) {
        file = path.resolve(this.path, imp.replace(this.#manifestContext.mainModule, '.'));
      } else {
        try {
          file = this.#req.resolve(imp);
        } catch {
          try {
            file = this.#req.resolve(imp.replace(/[.]js$/, '.ts').replace(/[.]jsx$/, '.tsx'));
          } catch { }
        }
      }
      this.#importToFile.set(imp, file);
    }
    return this.#importToFile.get(imp);
  }

  static resolveOutputFile(file: string): string {
    return path.resolve(this.#manifestContext.workspacePath, this.#manifestContext.outputFolder, file);
  }

  static resolveToolFile(file: string): string {
    return path.resolve(this.#manifestContext.workspacePath, this.#manifestContext.toolFolder, file);
  }

  static get #cliFile(): string {
    return this.#req.resolve('@travetto/cli/bin/trv.js');
  }

  static get #compilerCliFile(): string {
    return this.#req.resolve('@travetto/compiler/bin/trvc.js');
  }

  static #buildEnv(debug: boolean, base?: EnvDict, cliModule?: string): EnvDict {
    const res: EnvDict = {
      ...this.#baseEnv,
      ...(debug ? { TRV_DYNAMIC: '1', } : { TRV_QUIET: '1' }),
      ...base,
      TRV_MANIFEST: '',
      TRV_MODULE: cliModule ?? this.#manifestContext.mainModule
    };
    if (base && 'NO_COLOR' in base) {
      delete res.FORCE_COLOR;
    }
    return res;
  }

  /**
   * Get workspace uri
   */
  static get uri(): vscode.Uri {
    return vscode.Uri.file(this.path);
  }

  /**
   * Read theme using webview panel
   */
  static async getColorTheme(): Promise<{ light: boolean, highContrast: boolean }> {
    const subs: { dispose(): unknown }[] = [];
    const panel = vscode.window.createWebviewPanel('theme-detector', '',
      { preserveFocus: true, viewColumn: vscode.ViewColumn.Beside, },
      { enableScripts: true, localResourceRoots: [], },
    );
    subs.push(panel);

    const reading = new Promise<string>(res => subs.push(panel.webview.onDidReceiveMessage(res, undefined)));
    panel.webview.html = '<body onload="acquireVsCodeApi().postMessage(document.body.className)">';
    const final = await Promise.race([reading, timers.setTimeout(1000).then(x => undefined)]);
    for (const sub of subs) {
      sub.dispose();
    }

    return {
      light: (!!final && /vscode[^ ]*-light/.test(final)),
      highContrast: /vscode-high-contrast/.test(final ?? '')
    };
  }

  /**
   * Update general data for theme
   */
  static async writeTheme(): Promise<void> {
    const theme = await this.getColorTheme();
    const color = theme.light ? '0;15' : '15;0';
    const depth = theme?.highContrast ? '1' : '3';
    this.#baseEnv.COLORFGBG = color;
    this.context.environmentVariableCollection.replace('COLORFGBG', color);
    this.#baseEnv.FORCE_COLOR = depth;
    this.context.environmentVariableCollection.replace('FORCE_COLOR', depth);
  }

  /**
   * Initialize extension context
   * @param context
   */
  static async init(
    context: vscode.ExtensionContext,
    extensionIndex: ManifestIndex,
    manifestContext: ManifestContext
  ): Promise<void> {
    // @ts-expect-error
    this.context = context;
    this.#extensionIndex = extensionIndex;
    this.#manifestContext = manifestContext;
    this.#req = module.createRequire(path.resolve(manifestContext.workspacePath, 'node_modules'));

    await this.writeTheme();

    // Update config on change
    context.subscriptions.push(
      vscode.window.onDidChangeActiveColorTheme(() => this.writeTheme())
    );

    for (const ext of this.#extensionIndex.find({
      file: f => /.*\/feature.*?\/main[.]/.test(f.sourceFile)
    })) {
      await import(ext.import);
    }
  }

  /**
   * Sleep
   * @param ms
   */
  static sleep(ms: number): Promise<void> {
    return timers.setTimeout(ms);
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
   * @param mod
   */
  static async isInstalled(mod: string): Promise<boolean> {
    try {
      this.#req.resolve(`${mod}/package.json`);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Generate execution launch config
   * @param config
   */
  static generateLaunchConfig(config: LaunchConfig): vscode.DebugConfiguration {
    if (config.useCli) {
      config.args = [config.main, ...config.args ?? []];
      config.main = this.#cliFile;
    }

    /* eslint-disable no-template-curly-in-string */
    const res: vscode.DebugConfiguration = {
      type: 'node',
      request: 'launch',
      cwd: '${workspaceFolder}',
      sourceMaps: true,
      pauseForSourceMap: true,
      runtimeArgs: [],
      outFiles: [
        ['${workspaceFolder}', this.#manifestContext.outputFolder, '**', '*.js'].join('/'),
      ],
      resolveSourceMapLocations: [
        ['${workspaceFolder}', this.#manifestContext.outputFolder, '**'].join('/'),
      ],
      runtimeSourcemapPausePatterns: [
        ['${workspaceFolder}', this.#manifestContext.outputFolder, '**', 'test', '**', '*.js'].join('/'),
      ],
      skipFiles: [
        '<node_internals>/**',
        'node:internals/**',
        'internal/**',
        '**/@travetto/base/src/console.*',
        '**/@travetto/base/src/proxy.*',
        '**/@travetto/log/src/service.*',
        '**/@travetto/log/src/common.*',
        '**/@travetto/log/src/appender/console.*',
        '**/@travetto/context/src/service.*',
        '**/@travetto/rest/src/util/route.*',
        '**/tslib/**'
      ],
      console: 'internalConsole',
      internalConsoleOptions: 'openOnSessionStart',
      name: config.name,
      program: config.main.replace(this.path, '${workspaceFolder}'),
      args: (config.args ?? []).map(x => `${x}`),
      env: this.#buildEnv(true, config.env ?? {}, config.cliModule)
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

  /**
   * Spawn the CLI in the same form as ExecUtil.spawn
   * @param command
   * @param args
   * @param opts
   * @returns
   */
  static spawnCli(command: string, args?: string[], opts?: ExecutionOptions & { cliModule?: string }): ExecutionState {
    const env = this.#buildEnv(false, opts?.env, opts?.cliModule);
    this.#log.debug('Spawning', this.#cliFile, command, { args, env });
    return ExecUtil.spawn(
      'node', [this.#cliFile, command, ...args ?? []],
      { cwd: this.path, ...opts, env }
    );
  }

  /**
   * Spawn the compiler cli in the same form as ExecUtil.spawn
   * @param command
   * @returns
   */
  static spawnCompiler(command: string): ExecutionState {
    const env = this.#buildEnv(false);
    this.#log.debug('Spawning Compiler', this.#compilerCliFile, command, { env });
    return ExecUtil.spawn('node', [this.#compilerCliFile, command], { cwd: this.path, env });
  }

  /**
   * Invoke the CLI as a worker thread, allows for long running processes.
   * @param command
   * @param args
   * @param opts
   * @returns
   */
  static workerCli<T>(command: string, args?: string[], opts?: WorkerOptions & { env?: EnvDict, cliModule?: string }): WorkerResult<T> {
    return ExecUtil.worker<T>(
      this.#cliFile, [command, ...args ?? []],
      { ...opts, env: this.#buildEnv(false, opts?.env, opts?.cliModule) }
    );
  }

  /**
   * Create a manual promise, useful for controlled resolution and rejection.
   * @returns
   */
  static manualPromise<T>(): MProm<T> {
    let ops: Pick<MProm<T>, 'reject' | 'resolve'>;
    const prom = new Promise<T>((resolve, reject) => ops = { resolve, reject });
    return Object.assign(prom, ops!);
  }
}