import { MessageOptions, SentMessage } from './types';

/**
 * Default mail transport
 *
 * @concrete ./internal/types:MailTransportTarget
 */
export interface MailTransport {
  send(mail: MessageOptions): Promise<SentMessage>;
}

/**
 * Transport that consumes messages without sending
 */
export class NullTransport implements MailTransport {
  async send(mail: MessageOptions): Promise<SentMessage> {
    return {};
  }
}