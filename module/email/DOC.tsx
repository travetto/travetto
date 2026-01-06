/** @jsxImportSource @travetto/doc/support */
import { d, c } from '@travetto/doc';
import { toConcrete } from '@travetto/runtime';

import { NullTransport } from './src/transport.ts';
import { MailConfig } from './src/config.ts';
import type { EmailOptions } from './src/types.ts';

export const text = <>
  <c.StdHeader />
  A standard API for sending and rendering emails. The mail transport must be defined to allow for mail to be sent properly.  Out of the box, the only transport available by default is the {NullTransport} which will just drop emails. The structure of the API is derived from  {d.library('NodeMailer')}, but is compatible with any library that can handle the {toConcrete<EmailOptions>()} input. <br />

  To expose the necessary email transport, the following pattern is commonly used:

  <c.Code title='Declaring the null transport for development' src='doc/null.ts' />

  Given the amorphous nature of transports, the {d.input('transport')} field in {MailConfig} is open for any configuration that you may want there. Additionally, the templating engine is optional.  The code will only fail if you attempt to send a templated email without declaring the dependency first.

  <c.Section title='Sending Compiled Templates'>
    By design, sending an email requires the sender to specify the html, text optionally, and subject.  To integrate with other tools, the framework also has the ability to send an email as a set of templates, based off a single key. The module will look for:
    <ul>
      <li>{d.input('resources/<key>.compiled.html')}</li>
      <li>{d.input('resources/<key>.compiled.text')}</li>
      <li>{d.input('resources/<key>.compiled.subject')}</li>
    </ul>
    With {d.input('.html')} being the only required field.  The {d.mod('EmailCompiler')} module supports this format, and will generate files accordingly. Also, note that {d.input('<key>')} can include slashes, allowing for nesting folders.
  </c.Section>
</>;
