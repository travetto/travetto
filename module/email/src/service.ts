import { ResourceManager } from '@travetto/base';
import { Injectable } from '@travetto/di';

import { MessageOptions } from './types';
import { MailTransport } from './transport';
import { MailTemplateEngine } from './template';
import { MailUtil } from './util';

/**
 * Email service for sending and templating emails
 */
@Injectable()
export class MailService {

  private compiled = new Map<string, MessageOptions>();

  constructor(
    private transport: MailTransport,
    private tplEngine: MailTemplateEngine
  ) { }

  /**
   * Send multiple messages.
   */
  async sendAll(messages: MessageOptions[], base: Partial<MessageOptions> = {}) {
    return Promise.all(messages.map(msg => this.send({
      ...base,
      ...msg,
      ...(msg.context || base.context ? {
        context: {
          ...(base.context || {}),
          ...(msg.context || {})
        }
      } : {})
    })));
  }

  /**
   * Send a pre compiled email that has a relevant html and optional text file associated
   */
  async sendCompiled(key: string, msg: Omit<MessageOptions, 'html' | 'text'>): Promise<any> {
    if (!this.compiled.has(key)) {
      this.compiled.set(key, {
        html: await ResourceManager.read(`email/${key}.compiled.html`, 'utf8'),
        text: await ResourceManager.read(`email/${key}.compiled.txt`, 'utf8').catch(err => undefined),
      });
    }
    return this.send({
      ...msg,
      ...this.compiled.get(key)!
    });
  }

  /**
   * Send a single message
   */
  async send(msg: MessageOptions): Promise<any> {
    // Template if context is provided
    if (msg.context) {
      Object.assign(msg, {
        html: await this.tplEngine!.template(msg.html, msg.context),
        text: msg.text ? await this.tplEngine!.template(msg.text, msg.context) : undefined,
        subject: msg.subject ? await this.tplEngine!.template(msg.subject, msg.context) : undefined
      });
    }

    if (msg.html) {
      Object.assign(msg, MailUtil.extractImageAttachments(msg.html));
    }

    if (msg.text) {
      msg.alternatives = msg.alternatives || [];
      msg.alternatives.unshift({
        content: msg.text, contentDisposition: 'inline', contentTransferEncoding: '7bit', contentType: `text/plain; charset=utf-8`
      });
      delete msg.text;
    }

    return this.transport.send(msg);
  }
}