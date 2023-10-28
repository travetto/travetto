import vscode from 'vscode';

import { path } from '@travetto/manifest';

import { Workspace } from '../../../core/workspace';
import { Activatible } from '../../../core/activation';
import { ProcessServer } from '../../../core/server';

import { BaseFeature } from '../../base';

import { WorkspaceResultsManager } from './workspace';
import { RemoveEvent, TestCommand, TestEvent } from './types';

/**
 * Test Runner Feature
 */
@Activatible('@travetto/test', 'test')
class TestRunnerFeature extends BaseFeature {

  #server: ProcessServer<TestCommand, TestEvent | RemoveEvent | { type: 'log', message: string }>;
  #consumer: WorkspaceResultsManager;
  #codeLensUpdated: (e: void) => unknown;

  constructor(module?: string, command?: string) {
    super(module, command);
    this.#consumer = new WorkspaceResultsManager(this.log, vscode.window);
    this.#server = new ProcessServer(this.log, 'test:watch', ['-f', 'exec', '-m', 'change'])
      .listen('start', () => {
        this.#server.onMessage(['assertion', 'suite', 'test', 'log', 'removeTest'], ev => {
          switch (ev.type) {
            case 'log': this.log.info('[Log  ]', ev.message); return;
            case 'test': this.log.info('[Event]', ev.type, ev.phase, ev.test.classId, ev.test.methodName); break;
          }
          this.#consumer.onEvent(ev);
          this.#codeLensUpdated?.();
        });

        // Trigger all visible editors on start
        for (const editor of vscode.window.visibleTextEditors) {
          this.onChangedActiveEditor(editor);
        }
      })
      .listen('fail', err => vscode.window.showErrorMessage(`Test Server: ${err.message}`));
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

    if (editor && breakpoint) {
      Workspace.addBreakpoint(editor, line);
    }

    await vscode.debug.startDebugging(Workspace.folder, Workspace.generateLaunchConfig({
      useCli: true,
      name: 'Debug Travetto',
      main: 'test:direct',
      args: [file.replace(`${Workspace.path}/`, ''), `${line}`],
      cliModule: file
    }));
  }

  /**
   * Build code lenses for a given document
   * @param doc
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
    if (editor?.document.fileName.includes('/test/')) {
      this.#consumer.trackEditor(editor);
      if (!this.#consumer.getResults(editor.document)?.getListOfTests().length) {
        await this.#server.start();
        this.#server.sendMessage({ type: 'run-test', file: editor.document.fileName });
      }
    }
  }

  async onOpenTextDocument(doc: vscode.TextDocument): Promise<void> {
    if (doc.fileName.includes('/test/')) {
      await this.#server.start();
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
    this.register('line', this.launchTestDebugger.bind(this));
    this.register('start', () => this.#server.start());
    this.register('stop', () => this.#server.stop().then(() => {
      this.#consumer.resetAll();
    }));
    this.register('rerun', () => {
      this.#consumer.reset(vscode.window.activeTextEditor);
      this.#server.sendMessage({ type: 'run-test', file: vscode.window.activeTextEditor!.document.fileName });
    });

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