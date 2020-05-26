import * as vscode from 'vscode';
import * as path from 'path';
import { FsUtil, ExecutionState, ExecUtil } from '@travetto/boot';

import { Workspace } from '../../../core/workspace';
import { Activatible } from '../../../core/activation';
import { BaseFeature } from '../../base';
import { WorkspaceResultsManager } from './workspace';
import { TestEvent } from './types';


/**
 * Test Runner Feature
 */
@Activatible('@travetto/test', 'test')
class TestRunnerFeature extends BaseFeature {

  private consumer = new WorkspaceResultsManager(vscode.window);
  private runner: ExecutionState;
  private running = true;
  private cacheDir = `${Workspace.path}/.trv_cache_plugin`;

  /**
   * Launch a test from the current location
   */
  async launchTestDebugger(file?: string, line?: number, breakpoint: boolean = true) {
    const editor = Workspace.getDocumentEditor(vscode.window.activeTextEditor);
    if (editor) {
      line = line ?? editor.selection.start.line;
      file = file ?? editor.document.fileName;
    }

    if (!file || !line) {
      return;
    }

    if (editor && breakpoint) {
      Workspace.addBreakpoint(editor, line + 1);
    }

    return await vscode.debug.startDebugging(Workspace.folder, Workspace.generateLaunchConfig({
      name: 'Debug Travetto',
      program: this.resolvePlugin('test'),
      args: [
        file.replace(`${Workspace.path}${path.sep}`, ''),
        `${line + 1}`
      ],
      env: Workspace.getDefaultEnv({ DEBUG: '1' })
    }));
  }

  async launchTestServer() {
    FsUtil.copyRecursiveSync(`${Workspace.path}/.trv_cache`, this.cacheDir, true);

    this.runner = ExecUtil.fork(this.resolvePlugin('watch-test'), ['exec'], {
      env: { TRV_CACHE: this.cacheDir, },
      cwd: Workspace.path
    });

    this.runner.process.stdout?.pipe(process.stdout);
    this.runner.process.stderr?.pipe(process.stderr);

    this.runner.result.finally(() => {
      if (this.running) { // If still running, reinit
        this.killTestServer(true);
        FsUtil.unlinkRecursiveSync(this.cacheDir);
        this.launchTestServer();
      }
    });

    this.runner.process.addListener('message', ev => this.consumer.onEvent(ev as TestEvent));
  }

  /**
   * Stop runner
   */
  killTestServer(running: boolean) {
    console.debug('Test', 'Shutting down');
    this.running = running;
    if (this.runner && this.runner.process && !this.runner.process.killed) {
      this.runner.process.kill();
    }
    // Remove all state
    this.consumer.dispose();
  }

  /**
   * Build code lenses for a given document
   * @param doc
   */
  buildCodeLenses(doc: vscode.TextDocument) {
    const out: vscode.CodeLens[] = [];
    for (let i = 0; i < doc.lineCount; i++) {
      const line = doc.lineAt(i);
      if (line.text.includes('@Test')) {
        // Find start of function
        while (!/[{]\s*$/.test(doc.lineAt(i).text)) {
          i += 1;
        }

        const cmd = {
          range: line.range,
          isResolved: true,
          command: {
            command: this.commandName('line'),
            title: `Debug Test`,
            arguments: [doc.fileName, i + 1, true]
          }
        };
        // @ts-ignore
        out.push(cmd);
      }
    }
    return out;
  }

  /**
   * On feature activate
   */
  async activate(context: vscode.ExtensionContext) {
    this.register('line', this.launchTestDebugger.bind(this));
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
    }, { provideCodeLenses: this.buildCodeLenses.bind(this) });

    await this.launchTestServer();

    process.on('SIGKILL', this.deactivate.bind(this));
    process.on('SIGINT', this.deactivate.bind(this));
    process.on('exit', this.deactivate.bind(this));
  }

  /**
   * On feature deactivate
   */
  deactivate() {
    this.killTestServer(false);
  }
}