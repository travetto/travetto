import { MessageOptions, SentMessage } from './types';

/**
 * Default mail transport
 *
 * @concrete ./internal/types:MailTransportTarget
 */
export interface MailTransport {
  send<S extends SentMessage = SentMessage>(mail: MessageOptions): Promise<S>;
}

/**
 * Transport that consumes messages without sending
 */
export class NullTransport implements MailTransport {
  async send<S extends SentMessage = SentMessage>(mail: MessageOptions): Promise<S> {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return {} as S;
  }
}