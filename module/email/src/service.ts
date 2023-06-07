import { GlobalEnv } from '@travetto/base';
import { Injectable } from '@travetto/di';

import { MessageCompiled, MessageOptions, SentMessage } from './types';
import { MailTransport } from './transport';
import { MailInterpolator } from './template';
import { MailUtil } from './util';
import { EmailResource } from './resource';

type MessageWithoutBody = Omit<MessageOptions, keyof MessageCompiled>;

/**
 * Email service for sending and templating emails
 */
@Injectable()
export class MailService {

  #compiled = new Map<string, MessageCompiled>();
  #transport: MailTransport;
  #interpolator: MailInterpolator;
  #resources: EmailResource;

  constructor(
    transport: MailTransport,
    interpolator: MailInterpolator,
    resources: EmailResource
  ) {
    this.#interpolator = interpolator;
    this.#transport = transport;
    this.#resources = resources;
  }

  /**
   * Get compiled content by key
   */
  async getCompiled(key: string): Promise<MessageCompiled> {
    if (GlobalEnv.dynamic || !this.#compiled.has(key)) {
      const [html, text, subject] = await Promise.all([
        this.#resources.read(`${key}.compiled.html`),
        this.#resources.read(`${key}.compiled.text`),
        this.#resources.read(`${key}.compiled.subject`)
      ].map(x => x.then(MailUtil.purgeBrand)));

      this.#compiled.set(key, { html, text, subject });
    }
    return this.#compiled.get(key)!;
  }

  /**
   * Build message from key/context
   * @param keyOrMessage
   * @param ctx
   * @returns
   */
  async renderMessage(keyOrMessage: string | MessageCompiled, ctx: Record<string, unknown>): Promise<MessageCompiled> {
    const tpl = (typeof keyOrMessage === 'string' ? await this.getCompiled(keyOrMessage) : keyOrMessage);

    const [html, text, subject] = await Promise.all([
      this.#interpolator.render(tpl.html, ctx),
      this.#interpolator.render(tpl.text, ctx),
      this.#interpolator.render(tpl.subject, ctx)
    ]);

    return { html, text, subject };
  }

  /**
   * Send a single message
   */
  async send<S extends SentMessage = SentMessage>(
    message: Pick<MessageOptions, 'to' | 'from' | 'replyTo'>,
    key: string,
    ctx?: Record<string, unknown>,
    base?: MessageWithoutBody
  ): Promise<S>;
  async send<S extends SentMessage = SentMessage>(message: MessageOptions): Promise<S>;
  async send<S extends SentMessage = SentMessage>(
    message: MessageOptions | Pick<MessageOptions, 'to' | 'from' | 'replyTo'>,
    key?: string,
    ctx?: Record<string, unknown>,
    base?: MessageWithoutBody
  ): Promise<S> {
    const keyOrMessage = key ?? ('html' in message ? message : '') ?? '';
    const context = ctx ?? (('context' in message) ? message.context : {}) ?? {};
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const compiled = await this.renderMessage(keyOrMessage as MessageCompiled, context);

    const final = { ...base, ...message, ...compiled, context };

    // Extract images
    if (compiled.html) {
      const { html, attachments } = await MailUtil.extractImageAttachments(compiled.html);
      final.html = html;
      final.attachments = [...attachments, ...(final.attachments ?? [])];
    }

    return this.#transport.send<S>(final);
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