import { MessageOptions, SentMessage } from './types';

/**
 * Default mail transport
 */
export abstract class MailTransport {
  abstract sendMail(mail: MessageOptions): Promise<SentMessage>;
}

/**
 * Transport that consumes messages without sending
 */
export class NullTransport extends MailTransport {
  async sendMail(mail: MessageOptions): Promise<SentMessage> {
    return {};
  }
}