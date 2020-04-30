import { MessageOptions, SentMessage } from './types';

// TODO: Document
export abstract class MailTransport {
  abstract sendMail(mail: MessageOptions): Promise<SentMessage>;
}

// TODO: Document
export class NullTransport extends MailTransport {
  async sendMail(mail: MessageOptions): Promise<SentMessage> {
    return {};
  }
}