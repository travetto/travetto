import { GlobalEnv } from '@travetto/base';
import { Injectable } from '@travetto/di';

import { MessageOptions, SentMessage } from './types';
import { MailTransport } from './transport';
import { MailTemplateEngine } from './template';
import { MailUtil } from './util';
import { EmailResource } from './resource';

type MessageWithoutBody = Omit<MessageOptions, 'html' | 'text' | 'subject'>;

/**
 * Email service for sending and templating emails
 */
@Injectable()
export class MailService {

  #compiled = new Map<string, { html: string, subject: string, text?: string }>();
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
   * Get compiled content by key
   */
  async getCompiled(key: string): Promise<{ html: string, text?: string, subject: string }> {
    if (GlobalEnv.dynamic || !this.#compiled.has(key)) {
      const [html, text, subject] = await Promise.all([
        this.#resources.read(`${key}.compiled.html`),
        this.#resources.read(`${key}.compiled.text`).catch(() => ''),
        this.#resources.read(`${key}.compiled.subject`)
      ]);

      this.#compiled.set(key, { html, text, subject });
    }
    return this.#compiled.get(key)!;
  }

  /**
   * Build message from key/context
   * @param key
   * @param ctx
   * @returns
   */
  async buildMessage(key: string | MessageOptions, ctx: Record<string, unknown>): Promise<MessageOptions> {
    const tpl = (typeof key === 'string' ? await this.getCompiled(key) : key);

    const [rawHtml, text, subject] = await Promise.all([
      tpl.html ? this.#tplEngine!.template(tpl.html, ctx) : undefined,
      tpl.text ? this.#tplEngine!.template(tpl.text, ctx) : undefined,
      tpl.subject ? this.#tplEngine!.template(tpl.subject, ctx) : undefined
    ]);

    const msg: MessageOptions = {
      html: rawHtml ?? '',
      text,
      subject
    };

    if (msg.html) {
      const { html, attachments } = await MailUtil.extractImageAttachments(msg.html);
      msg.html = html;
      msg.attachments = attachments;
    }

    return msg;
  }

  /**
   * Send a single message
   */
  async send<S extends SentMessage = SentMessage>(key: string, ctx?: Record<string, unknown>, base?: MessageWithoutBody): Promise<S>;
  async send<S extends SentMessage = SentMessage>(message: MessageOptions): Promise<S>;
  async send<S extends SentMessage = SentMessage>(keyOrMessage: MessageOptions | string, ctx?: Record<string, unknown>, base?: MessageWithoutBody): Promise<S> {
    ctx ??= (typeof keyOrMessage === 'string' ? {} : keyOrMessage.context) ?? {};
    const msg = await this.buildMessage(keyOrMessage, ctx);
    return this.#transport.send<S>({ ...base, ...msg });
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
}