import vscode from 'vscode';
import { ChildProcess, SpawnOptions, spawn } from 'node:child_process';

import { Env, ExecUtil } from '@travetto/runtime';
import type { TestWatchEvent } from '@travetto/test/src/execute/watcher';

import { Workspace } from '../../../core/workspace';
import { Activatible } from '../../../core/activation';
import { RunUtil } from '../../../core/run';

import { BaseFeature } from '../../base';

import { WorkspaceResultsManager } from './workspace';

/**
 * Test Runner Feature
 */
@Activatible('@travetto/test', 'test')
class TestRunnerFeature extends BaseFeature {

  #server: ChildProcess | undefined;
  #consumer: WorkspaceResultsManager;
  #codeLensUpdated: (e: void) => unknown;

  #stopServer(force = false): void {
    if (!this.#server) { return; }

    this.log.info('Stopping server');
    this.#server.kill();
    this.#server = undefined;
    if (force) {
      this.#consumer.resetAll();
    }
  }

  #startServer(): void {
    if (this.#server || Workspace.compilerState !== 'watch-start') { return; }

    this.log.info('Starting server');
    const config: SpawnOptions = {
      cwd: Workspace.path,
      env: {
        ...process.env,
        ...Env.TRV_MANIFEST.export(undefined),
        ...Env.TRV_QUIET.export(true),
        ...Env.TRV_DYNAMIC.export(true)
      },
      stdio: ['pipe', 'pipe', 2, 'ipc']
    };

    this.#server = spawn('node', [RunUtil.cliFile, 'test:watch', '--format', 'exec', '--mode', 'change'], config)
      .on('message', (ev: TestWatchEvent) => {
        switch (ev.type) {
          case 'ready': {
            // Trigger all visible editors on start
            for (const editor of vscode.window.visibleTextEditors) {
              this.onChangedActiveEditor(editor);
            }
            return;
          }
          case 'log': this.log.info('[Log  ]', ev.message); return;
          case 'test': this.log.info('[Event]', ev.type, ev.phase, ev.test.classId, ev.test.methodName); break;
        }
        this.#consumer.onEvent(ev);
        this.#codeLensUpdated?.();
      });

    if (this.#server.stderr) {
      ExecUtil.readLines(this.#server.stderr, (line) => this.log.debug(`> stderr > ${line.trimEnd()}`));
    }
    if (this.#server.stdout) {
      ExecUtil.readLines(this.#server.stdout, (line) => this.log.debug(`> stdout > ${line.trimEnd()}`));
    }
  }

  #getTestImport(doc?: vscode.TextDocument | vscode.TextEditor): string | undefined {
    if (!doc) {
      return;
    }
    const imp = this.#consumer.getImport(doc);
    if (imp) {
      const entry = Workspace.workspaceIndex.getFromImport(imp);
      if (entry && entry.role === 'test' && (entry.type === 'ts' || entry.type === 'js')) {
        return imp;
      } else if (/test\/.*[.][tj]sx?$/.test(imp)) {
        return imp;
      }
    }
    return;
  }

  #isTestDoc(doc: vscode.TextEditor | vscode.TextDocument | undefined): boolean {
    return Workspace.isCompilerWatching && !!this.#getTestImport(doc);
  }

  #runFile(doc: vscode.TextDocument): void {
    const imp = this.#getTestImport(doc);

    if (!imp) {
      this.log.error('Unknown import', imp, 'skipping');
      return;
    }

    if (!this.#server) {
      this.log.warn('Server is not currently running');
      return;
    }


    this.#server.send({ type: 'run-test', import: imp });
  }

  #rerunActive(): void {
    const editor = vscode.window.activeTextEditor;
    if (this.#isTestDoc(editor)) {
      this.#startServer();
      this.#consumer.reset(editor);
      this.#runFile(editor!.document);
    }
  }

  constructor(module?: string, command?: string) {
    super(module, command);
    this.#consumer = new WorkspaceResultsManager(this.log, vscode.window);
  }

  /**
   * Launch a test from the current location
   */
  async #launchTestDebugger(line?: number): Promise<void> {
    const editor = Workspace.getDocumentEditor(vscode.window.activeTextEditor);
    if (!editor || !this.#isTestDoc(editor)) {
      return;
    }

    line ??= (editor.selection.start.line + 1);
    const imp = this.#consumer.getImport(editor);
    const mod = Workspace.workspaceIndex.findModuleForArbitraryFile(editor.document.fileName)!;

    await RunUtil.debug({
      useCli: true,
      name: `Debug Travetto Test - ${imp}`,
      main: 'test:direct',
      args: [imp!, `${line}`],
      cliModule: mod.name,
      env: {
        ...Env.TRV_TEST_PHASE_TIMEOUT.export('5m'),
        ...Env.TRV_TEST_TIMEOUT.export('1h'),
        ...Env.TRV_TEST_BREAK_ENTRY.export(true)
      }
    });
  }

  /**
   * Build code lenses for a given document
   */
  buildCodeLenses(doc: vscode.TextDocument): vscode.CodeLens[] {
    return (this.#consumer.getResults(doc)?.getListOfTests() || [])
      .filter(v => v.lineStart < doc.lineCount && doc.lineAt(v.lineStart - 1).text.includes('@Test'))
      .map(v => ({
        range: doc.lineAt(v.lineStart - 1).range,
        isResolved: true,
        command: {
          command: this.commandName('line'),
          title: 'Debug Test',
          arguments: [v.lineBodyStart]
        }
      }));
  }

  async onChangedActiveEditor(editor: vscode.TextEditor | undefined): Promise<void> {
    if (editor && this.#isTestDoc(editor)) {
      this.#startServer();
      this.#consumer.trackEditor(editor);
      if (!this.#consumer.getResults(editor.document)?.getListOfTests().length) {
        this.#runFile(editor.document);
      }
    }
  }

  async onOpenTextDocument(doc: vscode.TextDocument): Promise<void> {
    if (this.#isTestDoc(doc)) {
      this.#startServer();
      this.#consumer.trackEditor(doc);
    }
  }

  async onCloseTextDocument(doc: vscode.TextDocument): Promise<void> {
    this.#consumer.untrackEditor(doc);
  }

  /**
   * On feature activate
   */
  async activate(context: vscode.ExtensionContext): Promise<void> {
    this.register('line', (line?: number) => this.#launchTestDebugger(line));
    this.register('stop', () => this.#stopServer(true));
    this.register('start', () => this.#startServer());
    this.register('rerun', () => this.#rerunActive());

    Workspace.onCompilerState(state => (state === 'watch-start') ?
      this.onChangedActiveEditor(vscode.window.activeTextEditor) :
      this.#stopServer()
    );
    vscode.workspace.onDidOpenTextDocument(x => this.onOpenTextDocument(x), null, context.subscriptions);
    vscode.workspace.onDidCloseTextDocument(x => this.onCloseTextDocument(x), null, context.subscriptions);
    vscode.window.onDidChangeActiveTextEditor(x => this.onChangedActiveEditor(x), null, context.subscriptions);

    context.subscriptions.push(vscode.languages.registerCodeLensProvider({
      pattern: {
        baseUri: Workspace.uri,
        base: Workspace.path,
        pattern: '**/test/**/*.{ts,tsx}'
      }
    }, {
      provideCodeLenses: doc => this.buildCodeLenses(doc),
      onDidChangeCodeLenses: l => {
        this.#codeLensUpdated = l;
        return { dispose: (): void => { } };
      }
    }));
  }
}