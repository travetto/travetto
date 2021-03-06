import * as vscode from 'vscode';
import * as path from 'path';

import { NativeUtil } from '@travetto/boot/src/internal';

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

  private server: ProcessServer;
  private consumer = new WorkspaceResultsManager(vscode.window);
  private cacheDir = `${Workspace.path}/.trv_cache_plugin`;
  private codeLensUpdated: (e: void) => unknown;

  constructor(
    module?: string,
    command?: string
  ) {
    super(module, command);
    this.server = new ProcessServer('node', [this.resolvePlugin('watch-test'), 'exec'], {
      env: { TRV_CACHE: this.cacheDir, },
      cwd: Workspace.path
    });

    this.server.on('stop', () => this.clean());
    this.server.on('pre-start', () => this.clean(true));
    this.server.on('start', () => {
      this.server.onMessage('*', (type, ev) => {
        this.consumer.onEvent(ev as TestEvent);
        this.codeLensUpdated?.();
      });

      this.server.onceMessage('*', () =>  // Listen for first message
        this.consumer.trackEditor(vscode.window.activeTextEditor));
    });
  }

  /** Clean up */
  clean(recopy = false) {
    this.consumer.dispose();
    NativeUtil.unlinkRecursiveSync(this.cacheDir, t);
    if (recopy) {
      NativeUtil.copyRecursiveSync(`${Workspace.path}/.trv_cache`, this.cacheDir, t);
    }
  }

  /**
   * Launch a test from the current location
   */
  async launchTestDebugger(file?: string, line?: number, breakpoint: boolean = true) {
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

    return await vscode.debug.startDebugging(Workspace.folder, Workspace.generateLaunchConfig({
      name: 'Debug Travetto',
      program: this.resolvePlugin('test'),
      args: [
        file.replace(`${Workspace.path}${path.sep}`, ''),
        `${line}`
      ],
      env: Workspace.getDefaultEnv()
    }));
  }

  /**
   * Build code lenses for a given document
   * @param doc
   */
  buildCodeLenses(doc: vscode.TextDocument) {
    return (this.consumer.getResults(doc)?.getListOfTests() || [])
      .filter(x => x.start < doc.lineCount && doc.lineAt(x.start - 1).text.includes('@Test'))
      .map(test => ({
        range: doc.lineAt(test.start - 1).range,
        isResolved: true,
        command: {
          command: this.commandName('line'),
          title: 'Debug Test',
          arguments: [doc.fileName, test.code, true]
        }
      }) as vscode.CodeLens);
  }

  /**
   * On feature activate
   */
  async activate(context: vscode.ExtensionContext) {
    this.register('line', this.launchTestDebugger.bind(this));
    this.register('reload', () => this.server.restart());
    this.register('rerun', () => this.consumer.trackEditor(vscode.window.activeTextEditor));

    vscode.workspace.onDidOpenTextDocument(x => this.consumer.trackEditor(x), null, context.subscriptions);
    vscode.workspace.onDidCloseTextDocument(x => this.consumer.untrackEditor(x), null, context.subscriptions);
    vscode.window.onDidChangeActiveTextEditor(x => this.consumer.trackEditor(x), null, context.subscriptions);

    setTimeout(() => vscode.window.visibleTextEditors.forEach(x => this.consumer.trackEditor(x)), 1000);

    vscode.languages.registerCodeLensProvider({
      language: 'typescript',
      pattern: {
        base: Workspace.path,
        pattern: 'test/**'
      }
    }, {
      provideCodeLenses: this.buildCodeLenses.bind(this),
      onDidChangeCodeLenses: l => {
        this.codeLensUpdated = l;
        return { dispose: () => { } };
      }
    });

    await this.server.start();
  }
}