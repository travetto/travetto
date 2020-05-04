import { Config } from '@travetto/config';

/**
 * Simple mail configuration
 */
@Config('mail')
export class MailConfig {
  /** Transport specific config */
  transport = {};
  defaults = {
    /**  Default email title */
    title: 'Email Title',
    /** Default from */
    from: 'Travetto Mailer <mailer@travetto.dev>',
    /** Default reply-to */
    replyTo: 'Travetto Mailer <mailer@travetto.dev>',
  };
}