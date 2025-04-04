import { Runtime, RuntimeResources } from '@travetto/runtime';
import { Injectable } from '@travetto/di';

import { EmailCompiled, EmailOptions, SentEmail } from './types.ts';
import { MailTransport } from './transport.ts';
import { MailInterpolator } from './template.ts';
import { MailUtil } from './util.ts';

type MessageWithoutBody = Omit<EmailOptions, keyof EmailCompiled>;

/**
 * Email service for sending and templating emails
 */
@Injectable()
export class MailService {

  #compiled = new Map<string, EmailCompiled>();
  #transport: MailTransport;
  #interpolator: MailInterpolator;

  constructor(
    transport: MailTransport,
    interpolator: MailInterpolator,
  ) {
    this.#interpolator = interpolator;
    this.#transport = transport;
  }

  /**
   * Get compiled content by key
   */
  async getCompiled(key: string): Promise<EmailCompiled> {
    if (Runtime.dynamic || !this.#compiled.has(key)) {
      const [html, text, subject] = await Promise.all([
        RuntimeResources.read(`${key}.compiled.html`),
        RuntimeResources.read(`${key}.compiled.text`),
        RuntimeResources.read(`${key}.compiled.subject`)
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
  async renderMessage(keyOrMessage: string | EmailCompiled | EmailOptions, ctx: Record<string, unknown>): Promise<EmailCompiled> {
    const tpl = (typeof keyOrMessage === 'string' ? await this.getCompiled(keyOrMessage) : keyOrMessage);

    const [html, text, subject] = await Promise.all([
      this.#interpolator.render(tpl.html, ctx),
      this.#interpolator.render(tpl.text ?? '', ctx),
      this.#interpolator.render(tpl.subject, ctx)
    ]);

    return { html, text, subject };
  }

  /**
   * Send a single message
   */
  async send<S extends SentEmail = SentEmail>(
    message: Pick<EmailOptions, 'to' | 'from' | 'replyTo'>,
    key: string,
    ctx?: Record<string, unknown>,
    base?: MessageWithoutBody
  ): Promise<S>;
  async send<S extends SentEmail = SentEmail>(message: EmailOptions): Promise<S>;
  async send<S extends SentEmail = SentEmail>(
    message: EmailOptions | Pick<EmailOptions, 'to' | 'from' | 'replyTo'>,
    key?: string,
    ctx?: Record<string, unknown>,
    base?: MessageWithoutBody
  ): Promise<S> {
    const keyOrMessage = key ?? ('html' in message ? message : '') ?? '';
    const context = ctx ?? (('context' in message) ? message.context : {}) ?? {};
    const compiled = await this.renderMessage(keyOrMessage, context);

    const final = { ...base, ...message, ...compiled, context };

    // Extract images
    if (compiled.html) {
      const { html, attachments } = await MailUtil.extractImageAttachments(compiled.html);
      final.html = html;
      final.attachments = [...attachments, ...(final.attachments ?? [])];
    }

    // Disable threading if desired, provide a unique message id and a unique reply-to
    if ('disableThreading' in message && message.disableThreading) {
      const id = MailUtil.buildUniqueMessageId(message);
      final.headers = {
        'In-Reply-To': id,
        References: id,
        'X-Message-Id': id,
        ...final.headers
      };
    }

    return this.#transport.send<S>(final);
  }

  /**
   * Send multiple messages.
   */
  async sendAll<S extends SentEmail = SentEmail>(messages: EmailOptions[], base: Partial<EmailOptions> = {}): Promise<S[]> {
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