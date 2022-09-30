import * as vscode from 'vscode';
import * as path from 'path';

import { FsUtil } from '@travetto/boot';

import { Workspace } from '../../../core/workspace';
import { Activatible } from '../../../core/activation';
import { ProcessServer } from '../../../core/server';
import { BaseFeature } from '../../base';
import { WorkspaceResultsManager } from './workspace';
import { TestEvent } from './types';

/**
 * Test Runner Feature
 */
@Activatible('test', 'test')
class TestRunnerFeature extends BaseFeature {

  #server: ProcessServer;
  #consumer = new WorkspaceResultsManager(vscode.window);
  #cacheDir = `${Workspace.path}/.trv_cache_plugin`;
  #codeLensUpdated: (e: void) => unknown;

  constructor(
    module?: string,
    command?: string
  ) {
    super(module, command);
    this.#server = new ProcessServer(Workspace.mainPath(this.module, 'test-watch'), ['exec'], {
      env: { TRV_CACHE: this.#cacheDir, }
    });

    this.#server
      .on('stop', () => this.clean())
      .on('pre-start', () => this.clean(true))
      .on('start', () => {
        this.#server.onMessage('*', (type, ev: TestEvent) => {
          this.#consumer.onEvent(ev);
          this.#codeLensUpdated?.();
        });

        this.#server.onceMessage('*', () =>  // Listen for first message
          this.#consumer.trackEditor(vscode.window.activeTextEditor));
      });
  }

  /** Clean up */
  async clean(recopy = false): Promise<void> {
    this.#consumer.dispose();
    await FsUtil.unlinkRecursive(this.#cacheDir);
    if (recopy) {
      await FsUtil.copyRecursive(`${Workspace.path}/.trv_cache`, this.#cacheDir, true);
    }
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

    await vscode.debug.startDebugging(Workspace.folder, Workspace.generateLaunchConfig(
      'Debug Travetto',
      Workspace.binPath(this.module, 'test-direct'),
      [file.replace(`${Workspace.path}${path.sep}`, ''), `${line}`],
      { TRV_TEST_DELAY: '2s' }
    ));
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

  /**
   * On feature activate
   */
  async activate(context: vscode.ExtensionContext): Promise<void> {
    this.register('line', this.launchTestDebugger.bind(this));
    this.register('reload', () => this.#server.restart());
    this.register('rerun', () => this.#consumer.trackEditor(vscode.window.activeTextEditor));

    vscode.workspace.onDidOpenTextDocument(x => this.#consumer.trackEditor(x), null, context.subscriptions);
    vscode.workspace.onDidCloseTextDocument(x => this.#consumer.untrackEditor(x), null, context.subscriptions);
    vscode.window.onDidChangeActiveTextEditor(x => this.#consumer.trackEditor(x), null, context.subscriptions);

    Workspace.sleep(1000).then(() => {
      vscode.window.visibleTextEditors.forEach(x => this.#consumer.trackEditor(x));
    });

    vscode.languages.registerCodeLensProvider({
      language: 'typescript',
      pattern: {
        baseUri: Workspace.uri,
        base: Workspace.path,
        pattern: 'test/**'
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