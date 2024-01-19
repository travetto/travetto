import vscode from 'vscode';
import { ChildProcess, SpawnOptions, spawn } from 'node:child_process';

import { IndexedModule, ManifestModule, path } from '@travetto/manifest';
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

  #getTestModule(file?: string): IndexedModule | ManifestModule | undefined {
    if (!file) {
      return;
    }
    const mod = Workspace.workspaceIndex.getModuleFromSource(file) ??
      Workspace.workspaceIndex.findModuleForArbitraryFile(file);
    if (mod && file.startsWith(path.resolve(Workspace.path, mod.sourceFolder, 'test'))) {
      return mod;
    }
  }

  #isTestDoc(doc: vscode.TextEditor | vscode.TextDocument | undefined): boolean {
    const file = doc ? ('fileName' in doc ? doc.fileName : doc.document.fileName) : undefined;
    return Workspace.isCompilerWatching && !!this.#getTestModule(file);
  }

  #runFile(file: string, line?: number): void {
    const mod = this.#getTestModule(file);

    if (!mod) {
      this.log.error('Unknown file', file, 'skipping');
      return;
    }

    this.#activeProcesses[file]?.kill(); // Ensure only one at a time

    const args = [
      RunUtil.cliFile,
      'test:direct', '-f', 'exec',
      file, `${line ?? '0'}`
    ];

    const config: SpawnOptions = {
      cwd: Workspace.path,
      env: {
        ...process.env,
        ...Env.TRV_MANIFEST.export(undefined),
        ...Env.TRV_MODULE.export(mod.name),
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
  async launchTestDebugger(line?: number): Promise<void> {
    const editor = Workspace.getDocumentEditor(vscode.window.activeTextEditor);
    if (!editor || !this.#isTestDoc(editor)) {
      return;
    }

    line ??= (editor.selection.start.line + 1);
    const file = path.toPosix(editor.document.fileName ?? '');
    const prettyFile = file.replace(`${Workspace.path}/`, '');
    const mod = Workspace.workspaceIndex.findModuleForArbitraryFile(file)!;

    await RunUtil.debug({
      useCli: true,
      name: `Debug Travetto Test - ${prettyFile}`,
      main: 'test:direct',
      args: [prettyFile, `${line}`],
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
      .filter(x => x.start < doc.lineCount && doc.lineAt(x.start - 1).text.includes('@Test'))
      .map(test => ({
        range: doc.lineAt(test.start - 1).range,
        isResolved: true,
        command: {
          command: this.commandName('line'),
          title: 'Debug Test',
          arguments: [test.code]
        }
      }));
  }

  async onChangedActiveEditor(editor: vscode.TextEditor | undefined): Promise<void> {
    if (editor && this.#isTestDoc(editor)) {
      this.#consumer.trackEditor(editor);
      if (!this.#consumer.getResults(editor.document)?.getListOfTests().length) {
        this.#runFile(editor.document.fileName);
      }
    }
  }

  async onOpenTextDocument(doc: vscode.TextDocument): Promise<void> {
    if (this.#isTestDoc(doc)) {
      this.#consumer.trackEditor(doc);
    }
  }

  async onDidSaveTextDocument(doc: vscode.TextDocument): Promise<void> {
    if (this.#isTestDoc(doc)) {
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
      const editor = vscode.window.activeTextEditor;
      if (this.#isTestDoc(editor)) {
        this.#consumer.reset(editor);
        this.#runFile(editor!.document.fileName);
      }
    });

    Workspace.onCompilerState(state => {
      // Trigger all visible editors on start
      for (const editor of vscode.window.visibleTextEditors) {
        this.onChangedActiveEditor(editor);
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