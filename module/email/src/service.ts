import { GlobalEnv } from '@travetto/base';
import { Injectable } from '@travetto/di';

import { MessageOptions, SentMessage } from './types';
import { MailTransport } from './transport';
import { MailTemplateEngine } from './template';
import { MailUtil } from './util';
import { EmailResource } from './resource';

/**
 * Email service for sending and templating emails
 */
@Injectable()
export class MailService {

  #compiled = new Map<string, MessageOptions>();
  #transport: MailTransport;
  #tplEngine: MailTemplateEngine;
  #resources: EmailResource;

  constructor(
    transport: MailTransport,
    tplEngine: MailTemplateEngine,
    resources: EmailResource
  ) {
    this.#tplEngine = tplEngine;
    this.#transport = transport;
    this.#resources = resources;
  }

  /**
   * Send multiple messages.
   */
  async sendAll<S extends SentMessage = SentMessage>(messages: MessageOptions[], base: Partial<MessageOptions> = {}): Promise<S[]> {
    return Promise.all(messages.map(msg => this.send<S>({
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
  async sendCompiled<S extends SentMessage = SentMessage>(key: string, msg: Omit<MessageOptions, 'html' | 'text' | 'subject'>): Promise<S> {
    // Bypass cache if in dynamic mode
    if (GlobalEnv.dynamic || !this.#compiled.has(key)) {
      const [html, text, subject] = await Promise.all([
        this.#resources.read(`${key}.compiled.html`),
        this.#resources.read(`${key}.compiled.text`).catch(() => ''),
        this.#resources.read(`${key}.compiled.subject`)
      ]);

      this.#compiled.set(key, { html, text, subject });
    }
    return this.send<S>({ ...msg, ...this.#compiled.get(key)! });
  }

  /**
   * Send a single message
   */
  async send<S extends SentMessage>(msg: MessageOptions): Promise<S> {
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
      // @ts-expect-error
      delete msg.html; // This is a hack to fix nodemailer
    }

    return this.#transport.send<S>(msg);
  }
}