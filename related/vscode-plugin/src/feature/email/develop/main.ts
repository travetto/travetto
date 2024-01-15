import { EventEmitter } from 'node:events';
import { ChildProcess, spawn } from 'node:child_process';
import vscode from 'vscode';

import { Activatible } from '../../../core/activation';
import { RunUtil } from '../../../core/run';
import { Workspace } from '../../../core/workspace';

import { BaseFeature } from '../../base';
import { Content, EmailCompilerEvent } from './types';

/**
 * Email Template Feature
 */
@Activatible('@travetto/email-compiler', 'develop')
export class EmailCompilerFeature extends BaseFeature {

  static isTemplate(f?: string): boolean {
    return /[.]email[.]tsx$/.test(f ?? '');
  }

  #server: ChildProcess;
  #format?: 'text' | 'html';
  #active = new Set<string>();
  #activeFile?: string;
  #activeContent?: Content;
  #panel?: vscode.WebviewPanel;
  #emitter = new EventEmitter();

  #startServer(): void {
    if (this.#server && !this.#server.killed) {
      return;
    }

    this.#server = spawn('node', [RunUtil.cliFile, 'email:editor'],
      {
        cwd: Workspace.path,
        stdio: ['pipe', 'pipe', 'pipe', 'ipc']
      }
    )
      .on('message', async (ev: EmailCompilerEvent) => {
        switch (ev.type) {
          case 'changed': this.#emitter.emit('render', ev); break;
          case 'changed-failed': this.log.info('Email template', ev); break;
          case 'configured': {
            const doc = await vscode.workspace.openTextDocument(ev.file);
            await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
            break;
          }
          case 'init': {
            for (const el of vscode.window.visibleTextEditors) {
              this.trackFile(el.document, true);
            }

            if (vscode.window.activeTextEditor) {
              this.setActiveFile(vscode.window.activeTextEditor.document.fileName);
            }
            break;
          }
        }
      });
  }

  getPanel(): vscode.WebviewPanel {
    if (!this.#panel) {
      this.#panel = vscode.window.createWebviewPanel(`${this.moduleBase}.${this.command}.content`, 'Email Preview', {
        viewColumn: vscode.ViewColumn.Beside,
        preserveFocus: true
      });
      this.#panel.onDidDispose(d => {
        this.#panel = undefined;
      });
    }
    if (!this.#panel.visible) {
      this.#panel.reveal(vscode.ViewColumn.Beside, true);
    }
    return this.#panel!;
  }

  setActiveFile(file: string | undefined, force = false): void {
    if (!EmailCompilerFeature.isTemplate(file)) {
      return;
    }
    if (file !== this.#activeFile || force) {
      this.#activeFile = file;
      this.setActiveContent(undefined);
      if (file) {
        this.#server.send({ type: 'redraw', file: this.#activeFile! });
      }
    }
  }

  setActiveContent(content?: Content): void {
    this.#activeContent = content;
    if (this.#panel) {
      this.#panel.webview.html = !content ? '' : this.#format === 'text' ? `<pre>${content.text ?? ''}</pre>` : (content.html ?? '');
      this.#panel.title = !content ? '' : content.subject;
    }
  }

  trackFile(file: vscode.TextDocument, open: boolean): void {
    if (!EmailCompilerFeature.isTemplate(file.fileName)) {
      return;
    }
    if (open) {
      if (this.#active.size === 0) {
        this.#startServer();
      }
      this.#active.add(file.fileName);
    } else {
      this.#active.delete(file.fileName);
      if (this.#active.size === 0) {
        this.#server.kill();
      }
    }
  }

  async openPreview(format: 'html' | 'text'): Promise<void> {
    const active = vscode.window.activeTextEditor;
    const file = active?.document.fileName;
    if (!EmailCompilerFeature.isTemplate(file ?? '')) {
      return;
    }

    await this.getPanel();
    await this.#startServer();

    this.#format = format;

    if (this.#activeContent) {
      this.setActiveContent(this.#activeContent);
    } else {
      // Force a refresh
      this.setActiveFile(file, true);
    }
  }

  async openPreviewContext(): Promise<void> {
    this.#server?.send({ type: 'configure', file: this.#activeFile });
  }

  async sendEmail(): Promise<void> {
    if (this.#server?.killed === false && this.#activeFile) {
      this.#server.send({ type: 'send', file: this.#activeFile! });
    }
  }

  /**
   * On initial activation
   */
  activate(context: vscode.ExtensionContext): void {
    vscode.workspace.onDidOpenTextDocument(x => this.trackFile(x, true), null, context.subscriptions);
    vscode.workspace.onDidCloseTextDocument(x => this.trackFile(x, false), null, context.subscriptions);
    vscode.window.onDidChangeActiveTextEditor(x => this.setActiveFile(vscode.window.activeTextEditor?.document.fileName), null, context.subscriptions);

    this.#emitter.on('render', ({ file, content }: EmailCompilerEvent & { type: 'changed' }) => {
      if (file === this.#activeFile) {
        this.setActiveContent(content);
      }
    });

    this.register('preview-html', () => this.openPreview('html'));
    this.register('preview-text', () => this.openPreview('text'));
    this.register('preview-context', () => this.openPreviewContext());
    this.register('send', () => this.sendEmail());
  }
}