import { Config } from '@travetto/config';

@Config('mail')
// TODO: Document
export class MailConfig {
  transport = {};
  defaults = {
    title: 'Email Title',
    from: 'Travetto Mailer <mailer@travetto.org>',
    replyTo: 'Travetto Mailer <mailer@travetto.org>',
  };
}