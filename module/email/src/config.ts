import { Config } from '@encore/config';

@Config('mail')
export class MailConfig {
  transport = 'sendmail';
  defaults = {
    title: 'Email Title',
    from: 'Encore Mailer <mailer@encore.org>',
    replyTo: 'Encore Mailer <mailer@encore.org>',
  };
  inky = {};
}