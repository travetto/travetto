import { existsSync } from 'node:fs';
import vscode from 'vscode';
import { ChildProcess, SpawnOptions, spawn } from 'node:child_process';
import path from 'node:path';

import type { IndexedModule, ManifestModule } from '@travetto/manifest';
import type { TestWatchEvent } from '@travetto/test';
import { Env, ExecUtil } from '@travetto/runtime';

import { Workspace } from '../../../core/workspace.ts';
import { Activatible } from '../../../core/activation.ts';
import { RunUtil } from '../../../core/run.ts';

import { BaseFeature } from '../../base.ts';

import { WorkspaceResultsManager } from './workspace.ts';

/**
 * Test Runner Feature
 */
@Activatible('@travetto/test', 'test')
class TestRunnerFeature extends BaseFeature {

  #server: ChildProcess | undefined;
  #consumer: WorkspaceResultsManager;
  #codeLensUpdated: (event: void) => unknown;

  #stopServer(force = false): void {
    if (!this.#server) { return; }

    this.log.info('Stopping server');
    this.#server.kill();
    this.#server = undefined;
    if (force) {
      this.#consumer.resetAll();
    }
  }

  #restartServer(): void {
    this.#stopServer(true);
    this.#startServer();
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
      },
      stdio: ['pipe', 'pipe', 2, 'ipc']
    };

    this.#server = spawn('node', [RunUtil.cliFile, 'test:watch', '--format', 'exec', '--mode', 'change'], config)
      .on('message', (event: TestWatchEvent) => {
        switch (event.type) {
          case 'log': return this.log.info('[Log  ]', event.message);
          case 'test': this.log.info('[Event]', event.type, event.phase, event.test.classId, event.test.methodName); break;
          case 'removeTest': this.log.info('[Remove]', event.type, event.import, event.classId, event.methodName); break;
        }
        this.#consumer.onEvent(event);
        this.#codeLensUpdated?.();
      });

    if (this.#server.stderr) {
      ExecUtil.readLines(this.#server.stderr, (line) => this.log.debug(`> stderr > ${line.trimEnd()}`));
    }
    if (this.#server.stdout) {
      ExecUtil.readLines(this.#server.stdout, (line) => this.log.debug(`> stdout > ${line.trimEnd()}`));
    }
  }

  #getTestModule(file?: string): IndexedModule | ManifestModule | undefined {
    if (!file) {
      return;
    }
    const [mod, entry] = Workspace.resolveManifestIndexFileFromFile(file) ?? [];
    if (entry && entry.role === 'test' && (entry.type === 'ts' || entry.type === 'js')) {
      return mod;
    }
  }

  #isTestDocument(input: vscode.TextEditor | vscode.TextDocument | undefined): input is Exclude<typeof input, undefined> {
    const file = input ? ('fileName' in input ? input.fileName : input.document.fileName) : undefined;
    return Workspace.isCompilerWatching && !!this.#getTestModule(file);
  }

  #runFile(file: string): void {
    const mod = this.#getTestModule(file);

    if (!mod) {
      this.log.error('Unknown file', file, 'skipping');
      return;
    }

    if (!this.#server) {
      this.log.warn('Server is not currently running');
      return;
    }

    const imp = `${mod.name}${file.split(mod.sourceFolder)[1]}`;
    this.log.info('Requesting test run ', imp);
    this.#server.send({ type: 'runTest', import: imp });
  }

  #runDocument(document: vscode.TextDocument): void {
    this.#consumer.reset(document, true);
    this.#consumer.getResults(document);
    this.#runFile(document.fileName);
  }

  #rerunActive(): void {
    const editor = vscode.window.activeTextEditor;
    if (this.#isTestDocument(editor)) {
      this.#startServer();
      this.#runDocument(editor.document);
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
    const editor = vscode.window.activeTextEditor;
    if (!editor || !this.#isTestDocument(editor)) {
      return;
    }

    line ??= (editor.selection.start.line + 1);
    const file = path.resolve(editor.document.fileName ?? '');
    const prettyFile = file.replace(`${Workspace.path}/`, '');
    const mod = Workspace.workspaceIndex.findModuleForArbitraryFile(file)!;

    await RunUtil.debug({
      useCli: true,
      name: `Debug Travetto Test - ${prettyFile}`,
      main: 'test:direct',
      args: [prettyFile, `${line}`],
      module: mod.name,
      env: {
        ...Env.TRV_TEST_PHASE_TIMEOUT.export('5m'),
        ...Env.TRV_TEST_TIMEOUT.export('1h'),
        ...Env.TRV_DEBUG_BREAK.export(true)
      }
    });
  }

  /**
   * Build code lenses for a given document
   */
  buildCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    return (this.#consumer.getResults(document)?.getListOfTests() || [])
      .filter(test => test.lineStart < document.lineCount && document.lineAt(test.lineStart - 1).text.includes('@Test'))
      .map(test => ({
        range: document.lineAt(test.lineStart - 1).range,
        isResolved: true,
        command: {
          command: this.commandName('line'),
          title: 'Debug Test',
          arguments: [test.lineBodyStart]
        }
      }));
  }

  async onChangedActiveEditor(editor: vscode.TextEditor | undefined): Promise<void> {
    if (editor && this.#isTestDocument(editor)) {
      this.#startServer();

      if (!this.#consumer.setEditor(editor)) {
        this.#runFile(editor.document.fileName);
      }
    } else {
      this.#consumer.setEditor(undefined);
    }
  }

  async onOpenTextDocument(document: vscode.TextDocument): Promise<void> {
    if (this.#isTestDocument(document)) {
      this.#startServer();
      this.#consumer.openDocument(document);
    }
  }

  async onCloseTextDocument(document: vscode.TextDocument): Promise<void> {
    const stillExists = existsSync(document.fileName);
    this.#consumer.reset(document, !stillExists);
  }

  async renameFiles(files: vscode.FileRenameEvent['files']): Promise<void> {
    for (const file of files) {
      const document = this.#consumer.getDocumentByFileName(file.oldUri.fsPath);
      if (!document) {
        continue;
      }

      if (vscode.window.activeTextEditor?.document === document) {
        this.#consumer.setEditor(undefined);
        this.#runDocument(vscode.window.activeTextEditor.document);
        this.#consumer.setEditor(vscode.window.activeTextEditor);
      } else {
        this.#consumer.reset(document);
      }
    }
  }

  /**
   * On feature activate
   */
  async activate(context: vscode.ExtensionContext): Promise<void> {
    this.register('line', (line?: number) => this.#launchTestDebugger(line));
    this.register('stop', () => this.#stopServer(true));
    this.register('start', () => this.#startServer());
    this.register('restart', () => this.#restartServer());
    this.register('rerun', () => this.#rerunActive());

    Workspace.onCompilerState(state => (state === 'watch-start') ?
      this.onChangedActiveEditor(vscode.window.activeTextEditor) :
      this.#stopServer()
    );
    vscode.workspace.onDidOpenTextDocument(document => this.onOpenTextDocument(document), null, context.subscriptions);
    vscode.workspace.onDidCloseTextDocument(document => this.onCloseTextDocument(document), null, context.subscriptions);
    vscode.window.onDidChangeActiveTextEditor(editor => this.onChangedActiveEditor(editor), null, context.subscriptions);
    vscode.workspace.onDidRenameFiles(event => this.renameFiles(event.files), null, context.subscriptions);

    context.subscriptions.push(vscode.languages.registerCodeLensProvider({
      pattern: {
        baseUri: Workspace.uri,
        base: Workspace.path,
        pattern: '**/test/**/*.{ts,tsx}'
      }
    }, {
      provideCodeLenses: doc => this.buildCodeLenses(doc),
      onDidChangeCodeLenses: listener => {
        this.#codeLensUpdated = listener;
        return { dispose: (): void => { } };
      }
    }));
  }
}