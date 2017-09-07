import { Config } from '@encore2/config';

@Config('mail')
export class MailConfig {
  transport = 'sendmail';
  defaults = {
    title: 'Email Title',
    from: 'Encore Mailer <mailer@encore.org>',
    replyTo: 'Encore Mailer <mailer@encore.org>',
  };
  inky = {};

  postConstruct() {
    console.log(this);
  }
}