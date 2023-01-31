import vscode from 'vscode';

import { path } from '@travetto/manifest';

import { Workspace } from '../../../core/workspace';
import { Activatible } from '../../../core/activation';
import { ProcessServer } from '../../../core/server';
import { BaseFeature } from '../../base';

import { WorkspaceResultsManager } from './workspace';
import { TestEvent } from './types';

/**
 * Test Runner Feature
 */
@Activatible('@travetto/test', 'test')
class TestRunnerFeature extends BaseFeature {

  #server: ProcessServer;
  #consumer = new WorkspaceResultsManager(vscode.window);
  #codeLensUpdated: (e: void) => unknown;

  constructor(
    module?: string,
    command?: string
  ) {
    super(module, command);
    this.#server = new ProcessServer('main', [`${this.module}/src/execute/watcher`, 'exec', 'false']);

    this.#server
      .on('start', () => {
        this.#server.onMessage('*', (type, ev: TestEvent) => {
          this.#consumer.onEvent(ev);
          this.#codeLensUpdated?.();
        });

        this.#server.onceMessage('*', () =>  // Listen for first message
          this.#consumer.trackEditor(vscode.window.activeTextEditor));
      });
  }

  /**
   * Launch a test from the current location
   */
  async launchTestDebugger(file?: string, line?: number, breakpoint: boolean = true): Promise<void> {
    const editor = Workspace.getDocumentEditor(vscode.window.activeTextEditor);
    if (editor) {
      line = line ?? editor.selection.start.line + 1;
      file = file ?? editor.document.fileName;
    }

    if (!file || !line) {
      return;
    }

    if (editor && breakpoint) {
      Workspace.addBreakpoint(editor, line);
    }

    await vscode.debug.startDebugging(Workspace.folder, Workspace.generateLaunchConfig({
      useCli: true,
      name: 'Debug Travetto',
      main: 'main',
      args: [`${this.module}/support/bin/direct`, file.replace(path.toNative(`${Workspace.path}/`), ''), `${line}`],
      cliModule: Workspace.workspaceIndex.getFromSource(file)?.module
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
    if (editor) {
      if (editor.document.fileName.includes('/test/')) {
        this.#consumer.trackEditor(editor);
        if (!this.#consumer.getResults(editor.document)?.getListOfTests().length) {
          this.#server.sendMessage('run-test', { file: editor.document.fileName });
        }
      }
    }
  }

  async onOpenTextDocument(doc: vscode.TextDocument): Promise<void> {
    if (doc.fileName.includes('/test/')) {
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
    this.register('reload', () => this.#server.restart());
    this.register('rerun', () => this.#consumer.trackEditor(vscode.window.activeTextEditor));

    vscode.workspace.onDidOpenTextDocument(x => this.onOpenTextDocument(x), null, context.subscriptions);
    vscode.workspace.onDidCloseTextDocument(x => this.onCloseTextDocument(x), null, context.subscriptions);
    vscode.window.onDidChangeActiveTextEditor(x => this.onChangedActiveEditor(x), null, context.subscriptions);

    Workspace.sleep(1000).then(() => {
      vscode.window.visibleTextEditors.forEach(x => this.#consumer.trackEditor(x));
    });

    vscode.languages.registerCodeLensProvider({
      language: 'typescript',
      pattern: {
        baseUri: Workspace.uri,
        base: Workspace.path,
        pattern: '**/test/**'
      }
    }, {
      provideCodeLenses: this.buildCodeLenses.bind(this),
      onDidChangeCodeLenses: l => {
        this.#codeLensUpdated = l;
        return { dispose: (): void => { } };
      }
    });

    await this.#server.start();
  }
}