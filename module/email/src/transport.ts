import { MessageOptions, SentMessage } from './types';

/**
 * Default mail transport
 */
export abstract class MailTransport {
  abstract send(mail: MessageOptions): Promise<SentMessage>;
}

/**
 * Transport that consumes messages without sending
 */
export class NullTransport extends MailTransport {
  async send(mail: MessageOptions): Promise<SentMessage> {
    return {};
  }
}