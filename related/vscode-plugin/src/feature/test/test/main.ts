import vscode from 'vscode';
import { ChildProcess, SpawnOptions, spawn } from 'node:child_process';

import { path } from '@travetto/manifest';
import { Env } from '@travetto/base';

import { Workspace } from '../../../core/workspace';
import { Activatible } from '../../../core/activation';
import { RunUtil } from '../../../core/run';

import { BaseFeature } from '../../base';

import { WorkspaceResultsManager } from './workspace';
import { RemoveEvent, TestEvent } from './types';

type Event = TestEvent | RemoveEvent | { type: 'log', message: string };

/**
 * Test Runner Feature
 */
@Activatible('@travetto/test', 'test')
class TestRunnerFeature extends BaseFeature {

  #activeProcesses: Record<string, ChildProcess> = {};
  #consumer: WorkspaceResultsManager;
  #codeLensUpdated: (e: void) => unknown;

  #runFile(file: string, line?: number): void {
    this.#activeProcesses[file]?.kill(); // Ensure only one at a time

    const args = [
      RunUtil.cliFile,
      'test:direct', '-f', 'exec',
      file, `${line ?? '0'}`
    ];

    const mod = Workspace.workspaceIndex.getFromSource(file)!.module;

    const config: SpawnOptions = {
      cwd: Workspace.path,
      env: {
        ...process.env,
        ...Env.TRV_MANIFEST.export(undefined),
        ...Env.TRV_MODULE.export(mod),
        ...Env.TRV_QUIET.export(true)
      },
      stdio: ['pipe', 'pipe', 2, 'ipc']
    };

    const proc = spawn('node', args, config);

    proc.on('message', (ev: Event) => {
      switch (ev.type) {
        case 'log': this.log.info('[Log  ]', ev.message); return;
        case 'test': this.log.info('[Event]', ev.type, ev.phase, ev.test.classId, ev.test.methodName); break;
      }
      this.#consumer.onEvent(ev);
      this.#codeLensUpdated?.();
    });

    this.#activeProcesses[file] = proc;
  }

  constructor(module?: string, command?: string) {
    super(module, command);
    this.#consumer = new WorkspaceResultsManager(this.log, vscode.window);
  }

  /**
   * Launch a test from the current location
   */
  async launchTestDebugger(file?: string, line?: number, breakpoint: boolean = true): Promise<void> {
    const editor = Workspace.getDocumentEditor(vscode.window.activeTextEditor);
    if (editor) {
      line ??= editor.selection.start.line + 1;
      file ??= editor.document.fileName;
    }

    if (!file || !line) {
      return;
    }

    file = path.toPosix(file);

    const prettyFile = file.replace(`${Workspace.path}/`, '');

    await RunUtil.debug({
      useCli: true,
      name: `Debug Travetto Test - ${prettyFile}`,
      main: 'test:direct',
      args: [prettyFile, `${line}`],
      cliModule: file,
      env: {
        ...(breakpoint ? Env.TRV_TEST_BREAK_ENTRY.export(true) : {})
      }
    });
  }

  /**
   * Build code lenses for a given document
   */
  buildCodeLenses(doc: vscode.TextDocument): vscode.CodeLens[] {
    return (this.#consumer.getResults(doc)?.getListOfTests() || [])
      .filter(x => x.start < doc.lineCount && doc.lineAt(x.start - 1).text.includes('@Test'))
      .map(test => ({
        range: doc.lineAt(test.start - 1).range,
        isResolved: true,
        command: {
          command: this.commandName('line'),
          title: 'Debug Test',
          arguments: [doc.fileName, test.code, true]
        }
      }));
  }

  async onChangedActiveEditor(editor: vscode.TextEditor | undefined): Promise<void> {
    if (editor?.document.fileName.includes('/test/') && Workspace.isCompilerWatching) {
      this.#consumer.trackEditor(editor);
      if (!this.#consumer.getResults(editor.document)?.getListOfTests().length) {
        this.#runFile(editor.document.fileName);
      }
    }
  }

  async onOpenTextDocument(doc: vscode.TextDocument): Promise<void> {
    if (doc.fileName.includes('/test/') && Workspace.isCompilerWatching) {
      this.#consumer.trackEditor(doc);
    }
  }

  async onDidSaveTextDocument(doc: vscode.TextDocument): Promise<void> {
    if (doc.fileName.includes('/test/') && Workspace.isCompilerWatching) {
      let line = undefined;
      if (vscode.window.activeTextEditor?.document === doc) {
        const sels = vscode.window.activeTextEditor.selections;
        if (sels.length === 1) {
          line = sels[0].start.line;
        }
      }
      this.#runFile(doc.fileName, line);
    }
  }

  async onCloseTextDocument(doc: vscode.TextDocument): Promise<void> {
    this.#consumer.untrackEditor(doc);
  }

  /**
   * On feature activate
   */
  async activate(context: vscode.ExtensionContext): Promise<void> {
    this.register('line', this.launchTestDebugger.bind(this));
    this.register('rerun', () => {
      this.#consumer.reset(vscode.window.activeTextEditor);
      this.#runFile(vscode.window.activeTextEditor!.document.fileName);
    });

    Workspace.onCompilerState(state => {
      if (Workspace.isCompilerWatching) {
        // Trigger all visible editors on start
        for (const editor of vscode.window.visibleTextEditors) {
          this.onChangedActiveEditor(editor);
        }
      }
    });

    vscode.workspace.onDidSaveTextDocument(x => this.onDidSaveTextDocument(x), null, context.subscriptions);
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
      provideCodeLenses: this.buildCodeLenses.bind(this),
      onDidChangeCodeLenses: l => {
        this.#codeLensUpdated = l;
        return { dispose: (): void => { } };
      }
    }));
  }
}