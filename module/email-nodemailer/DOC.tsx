/** @jsxImportSource @travetto/doc */
import { d, c } from '@travetto/doc';

export const text = <>
  <c.StdHeader />
  Given the integration with {d.library('NodeMailer')}, all extensions should be usable out of the box. The primary {d.library('NodeMailer')} modules are provided (assuming dependencies are installed):

  <c.Code title='sendmail to send all messages via the sendmail operation' src='doc/sendmail.ts' />

  <c.Code title='smtp to send all messages via the smtp operation' src='doc/smtp.ts' />

  <c.Code title='ses to send all messages via the ses operation' src='doc/ses.ts' />
</>;