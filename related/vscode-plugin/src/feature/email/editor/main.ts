import { ChildProcess, spawn } from 'node:child_process';
import rl from 'node:readline/promises';
import vscode from 'vscode';

import { Util } from '@travetto/runtime';
import type { EditorResponse } from '@travetto/email-compiler/support/bin/types';
import type { EmailCompiled } from '@travetto/email';

import { Activatible } from '../../../core/activation';
import { RunUtil } from '../../../core/run';
import { Workspace } from '../../../core/workspace';

import { BaseFeature } from '../../base';

const isResource = (file: string): boolean => /[.](scss|css|png|jpe?g|gif|ya?ml|html)$/.test(file) && !/[.]compiled[.]/.test(file);
const isTemplate = (f?: string): boolean => /[.]email[.]tsx$/.test(f ?? '');

/**
 * Email Template Feature
 */
@Activatible('@travetto/email-compiler', 'editor')
export class EmailCompilerFeature extends BaseFeature {

  #server: ChildProcess | undefined;
  #format?: 'text' | 'html';
  #activeFile?: string;
  #activeContent?: EmailCompiled;
  #panel?: vscode.WebviewPanel;

  #stopServer(): void {
    if (!this.#server) { return; }

    this.log.info('Stopping server');
    this.#server.kill();
    this.#server = undefined;
  }

  #startServer(): void {
    if (this.#server || Workspace.compilerState !== 'watch-start') { return; }

    this.log.info('Starting server');
    this.#server = spawn('node', [RunUtil.cliFile, 'email:editor'], {
      cwd: Workspace.path,
      stdio: ['pipe', 'pipe', 'pipe', 'ipc']
    })
      .on('message', async (ev: EditorResponse) => {
        switch (ev.type) {
          case 'compiled': {
            if (ev.file === this.#activeFile) {
              this.setActiveContent(ev.content);
            }
            break;
          }
          case 'compiled-failed': return this.log.info('Email template', ev);
          case 'configured': {
            const doc = await vscode.workspace.openTextDocument(ev.file);
            await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
            break;
          }
          case 'sent': return Workspace.showEphemeralMessage(`Message Sent to ${ev.to}`);
          case 'sent-failed': return vscode.window.showErrorMessage(`Message not Sent. ${ev.message}`);
          case 'init': {
            if (vscode.window.activeTextEditor) {
              this.setActiveFile(vscode.window.activeTextEditor.document.fileName);
            }
          }
        }
      });

    if (this.#server.stderr) {
      Util.consumeAsyncItr(rl.createInterface(this.#server.stderr), (line) => this.log.debug(`> stderr > ${line.trimEnd()}`));
    }
    if (this.#server.stdout) {
      Util.consumeAsyncItr(rl.createInterface(this.#server.stdout), (line) => this.log.debug(`> stdout > ${line.trimEnd()}`));
    }
  }

  #compileActive(): void {
    this.#activeFile && this.#server?.send({ type: 'compile', file: this.#activeFile! });
  }

  getPanel(): vscode.WebviewPanel {
    if (!this.#panel) {
      this.#panel = vscode.window.createWebviewPanel(`${this.moduleBase}.${this.command}.content`, 'Email Preview', {
        viewColumn: vscode.ViewColumn.Beside,
        preserveFocus: true
      });
      this.#panel.onDidDispose(() => { this.#panel = undefined; });
    }
    if (!this.#panel.visible) {
      this.#panel.reveal(vscode.ViewColumn.Beside, true);
    }
    return this.#panel!;
  }

  setActiveFile(file: string | undefined): void {
    if (!isTemplate(file)) {
      return;
    }

    this.#startServer();

    if (file !== this.#activeFile) {
      this.#activeFile = file;
      this.setActiveContent(undefined);
      this.#compileActive();
    }
  }

  setActiveContent(content?: EmailCompiled): void {
    this.#activeContent = content;
    if (this.#panel) {
      this.#panel.webview.html = !content ? '' : this.#format === 'text' ? `<pre>${content.text ?? ''}</pre>` : (content.html ?? '');
      this.#panel.title = !content ? '' : content.subject;
    }
  }

  savedFile(file: vscode.TextDocument): void {
    if (isResource(file.fileName) && this.#activeFile) {
      this.#compileActive();
    }
  }

  async openPreview(format: 'html' | 'text'): Promise<void> {
    if (!this.#activeFile) { return; }

    await this.getPanel();

    this.#format = format;

    if (this.#activeContent) {
      this.setActiveContent(this.#activeContent);
    } else {
      this.#compileActive();
    }
  }

  async openPreviewContext(): Promise<void> {
    if (this.#activeFile) {
      this.#server?.send({ type: 'configure', file: this.#activeFile });
    }
  }

  async sendEmail(): Promise<void> {
    if (this.#activeFile) {
      this.#server?.send({ type: 'send', file: this.#activeFile });
    }
  }

  activeEditorChanged(e?: vscode.TextEditor): void {
    this.setActiveFile(e?.document.fileName);
  }

  /**
   * On initial activation
   */
  activate(context: vscode.ExtensionContext): void {
    vscode.workspace.onDidSaveTextDocument(x => this.savedFile(x), null, context.subscriptions);
    vscode.window.onDidChangeActiveTextEditor(x => this.activeEditorChanged(x), null, context.subscriptions);

    Workspace.onCompilerState(state => state === 'watch-start' ?
      this.activeEditorChanged(vscode.window.activeTextEditor) :
      this.#stopServer()
    );

    this.register('preview-html', () => this.openPreview('html'));
    this.register('preview-text', () => this.openPreview('text'));
    this.register('preview-context', () => this.openPreviewContext());
    this.register('send', () => this.sendEmail());
    this.register('start', () => this.#startServer());
    this.register('stop', () => this.#stopServer());
  }
}