import { EventEmitter } from 'events';
import * as vscode from 'vscode';

import { Activatible } from '../../../core/activation';
import { ProcessServer } from '../../../core/server';
import { Workspace } from '../../../core/workspace';

import { BaseFeature } from '../../base';

type Content = { html: string, text: string, subject: string };

/**
 * Email Template Feature
 */
@Activatible('email-template', 'develop')
export class EmailTemplateFeature extends BaseFeature {

  static isTemplate(f?: string) {
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

    this.#server = new ProcessServer(Workspace.binPath(this.module, 'editor'));

    this.#server.on('start', () => {
      this.#server.onMessage('changed', (type, msg) => this.#emitter.emit('render', msg));
    });
  }

  getPanel() {
    if (!this.#panel) {
      this.#panel = vscode.window.createWebviewPanel(`${this.commandBase}.content`, 'Email Preview', {
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

  setActiveFile(file: string | undefined, force = false) {
    if (!EmailTemplateFeature.isTemplate(file)) {
      return;
    }
    if (file !== this.#activeFile || force) {
      this.#activeFile = file;
      this.setActiveContent(undefined);
      if (file) {
        this.#server.sendMessage('redraw', { file });
      }
    }
  }

  setActiveContent(content?: Content) {
    this.#activeContent = content;
    if (this.#panel) {
      this.#panel.webview.html = !content ? '' : this.#format === 'text' ? `<pre>${content.text ?? ''}</pre>` : (content.html ?? '');
      this.#panel.title = !content ? '' : content.subject;
    }
  }

  trackFile(file: vscode.TextDocument, open: boolean) {
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

  async openPreview(format: 'html' | 'text') {
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

  async openPreviewContext() {
    const { file } = await this.#server.sendMessageAndWaitFor<{ file: string }>('configure', {}, 'configured');
    const doc = await vscode.workspace.openTextDocument(file);
    await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
  }

  async sendEmail() {
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
  activate(context: vscode.ExtensionContext) {
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