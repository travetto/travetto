import { Configure } from '@encore/config';

export default Configure.registerNamespace('mail', {
  transport: 'sendmail',
  defaults: {
    title: 'Email Title',
    from: 'Encore Mailer <mailer@encore.org>',
    replyTo: 'Encore Mailer <mailer@encore.org>',
  },
  inky: {}
});