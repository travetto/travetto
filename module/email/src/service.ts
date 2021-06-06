import { ResourceManager } from '@travetto/base';
import { Injectable } from '@travetto/di';
import { EnvUtil } from '@travetto/boot';

import { MessageOptions } from './types';
import { MailTransport } from './transport';
import { MailTemplateEngine } from './template';
import { MailUtil } from './util';

/**
 * Email service for sending and templating emails
 */
@Injectable()
export class MailService {

  #compiled = new Map<string, MessageOptions>();
  #transport: MailTransport;
  #tplEngine: MailTemplateEngine;

  constructor(
    transport: MailTransport,
    tplEngine: MailTemplateEngine
  ) {
    this.#tplEngine = tplEngine;
    this.#transport = transport;
  }

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
   * Send a pre compiled email that has a relevant html, subject and optional text file associated
   */
  async sendCompiled(key: string, msg: Omit<MessageOptions, 'html' | 'text' | 'subject'>): Promise<unknown> {
    // Bypass cache if in dynamic mode
    if (EnvUtil.isDynamic() || !this.#compiled.has(key)) {
      const [html, text, subject] = await Promise.all([
        ResourceManager.read(`${key}.compiled.html`, 'utf8'),
        ResourceManager.read(`${key}.compiled.text`, 'utf8').catch(() => ''),
        ResourceManager.read(`${key}.compiled.subject`, 'utf8')
      ]);

      this.#compiled.set(key, { html, text, subject });
    }
    return this.send({ ...msg, ...this.#compiled.get(key)! });
  }

  /**
   * Send a single message
   */
  async send(msg: MessageOptions): Promise<unknown> {
    // Template if context is provided
    if (msg.context) {
      const [html, text, subject] = await Promise.all([
        msg.html ? this.#tplEngine!.template(msg.html, msg.context) : undefined,
        msg.text ? this.#tplEngine!.template(msg.text, msg.context) : undefined,
        msg.subject ? this.#tplEngine!.template(msg.subject, msg.context) : undefined
      ]);

      Object.assign(msg, { html, text, subject });
    }

    if (msg.text) {
      (msg.alternatives = msg.alternatives || []).push({
        content: msg.text, contentDisposition: 'inline', contentTransferEncoding: '7bit', contentType: 'text/plain; charset=utf-8'
      });
      delete msg.text;
    }

    // Force html to the end per the mime spec
    if (msg.html) {
      const { html, attachments } = await MailUtil.extractImageAttachments(msg.html);
      (msg.attachments = msg.attachments || []).push(...attachments);
      (msg.alternatives = msg.alternatives || []).push({
        // NOTE: The leading space on the content type is to force node mailer to not do anything fancy with
        content: html, contentDisposition: 'inline', contentTransferEncoding: '7bit', contentType: ' text/html; charset=utf-8'
      });
      // @ts-ignore
      delete msg.html; // This is a hack to fix nodemailer
    }

    return this.#transport.send(msg);
  }
}