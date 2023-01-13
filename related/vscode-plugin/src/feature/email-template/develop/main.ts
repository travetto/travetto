import { EventEmitter } from 'events';
import vscode from 'vscode';

import { Activatible } from '../../../core/activation';
import { ProcessServer } from '../../../core/server';

import { BaseFeature } from '../../base';

type Content = { html: string, text: string, subject: string };

/**
 * Email Template Feature
 */
@Activatible('@travetto/email-template', 'develop')
export class EmailTemplateFeature extends BaseFeature {

  static isTemplate(f?: string): boolean {
    return /resources\/email\/.*[.]email[.]html$/.test(f ?? '');
  }

  #server: ProcessServer;

  #format?: 'text' | 'html';
  #active = new Set<string>();
  #activeFile?: string;
  #activeContent?: Content;
  #panel?: vscode.WebviewPanel;
  #emitter = new EventEmitter();

  constructor(
    module?: string,
    command?: string
  ) {
    super(module, command);

    this.#server = new ProcessServer('main', [`${this.module}/support/main.editor`]);

    this.#server.on('start', () => {
      this.#server.onMessage('changed', (type, msg) => this.#emitter.emit('render', msg));
      this.#server.onMessage('changed-failed', (ev, msg) => console.log(ev, msg));
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
    if (!EmailTemplateFeature.isTemplate(file)) {
      return;
    }
    if (file !== this.#activeFile || force) {
      file = file?.replace(/.*\/resources\/email\//, '');
      this.#activeFile = file;
      this.setActiveContent(undefined);
      if (file) {
        this.#server.sendMessage('redraw', { file: this.#activeFile });
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
    if (!EmailTemplateFeature.isTemplate(file.fileName)) {
      return;
    }
    if (open) {
      if (this.#active.size === 0) {
        this.#server.start();
      }
      this.#active.add(file.fileName);
    } else {
      this.#active.delete(file.fileName);
      if (this.#active.size === 0) {
        this.#server.stop();
      }
    }
  }

  async openPreview(format: 'html' | 'text'): Promise<void> {
    const active = vscode.window.activeTextEditor;
    const file = active?.document.fileName;
    if (!EmailTemplateFeature.isTemplate(file ?? '')) {
      return;
    }

    await this.getPanel();
    await this.#server.start();

    this.#format = format;

    if (this.#activeContent) {
      this.setActiveContent(this.#activeContent);
    } else {
      // Force a refresh
      this.setActiveFile(file, true);
    }
  }

  async openPreviewContext(): Promise<void> {
    const { file } = await this.#server.sendMessageAndWaitFor<{ file: string }>('configure', {}, 'configured');
    const doc = await vscode.workspace.openTextDocument(file);
    await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
  }

  async sendEmail(): Promise<void> {
    if (this.#server.running && this.#activeFile) {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          cancellable: false,
          title: 'Sending email'
        },
        () => this.#server.sendMessageAndWaitFor('send', { file: this.#activeFile }, 'sent', 'sent-failed').then(console.log)
          .catch(err => {
            vscode.window.showErrorMessage(err.message);
          })
      );
    }
  }

  /**
   * On initial activation
   */
  activate(context: vscode.ExtensionContext): void {
    vscode.workspace.onDidOpenTextDocument(x => this.trackFile(x, true), null, context.subscriptions);
    vscode.workspace.onDidCloseTextDocument(x => this.trackFile(x, false), null, context.subscriptions);
    vscode.window.onDidChangeActiveTextEditor(x => this.setActiveFile(vscode.window.activeTextEditor?.document.fileName), null, context.subscriptions);

    this.#emitter.on('render', ({ file, content }) => {
      if (file === this.#activeFile) {
        this.setActiveContent(content);
      }
    });

    for (const el of vscode.window.visibleTextEditors) {
      this.trackFile(el.document, true);
    }

    if (vscode.window.activeTextEditor) {
      this.setActiveFile(vscode.window.activeTextEditor.document.fileName);
    }

    this.register('preview-html', () => this.openPreview('html'));
    this.register('preview-text', () => this.openPreview('text'));
    this.register('preview-context', () => this.openPreviewContext());
    this.register('send', () => this.sendEmail());
  }
}