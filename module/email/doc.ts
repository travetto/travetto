import { d, lib, mod } from '@travetto/doc';

import { NullTransport } from './src/transport';
import { MailConfig } from './src/config';

export const text = d`
${d.Header()}

A standard API for sending and rendering emails. The mail transport must be defined to allow for mail to be sent properly.  Out of the box, the only transport available by default is the ${NullTransport} which will just drop emails. The structure of the API is derived from  ${lib.NodeMailer}, but is compatible with any library that can handle the ${d.SnippetLink('MessageOptions', 'src/types.ts', /interface MessageOptions/)} input.

To expose the necessary email transport, the following pattern is commonly used:

${d.Code('Declaring the null transport for development', 'doc/null.ts')}

Given the amorphous nature of transports, the ${d.Input('transport')} field in ${MailConfig} is open for any configuration that you may want there. Additionally, the templating engine is optional.  The code will only fail if you attempt to send a templated email without declaring the dependency first.

${d.Section('Sending Compiled Templates')}
By design, sending an email requires the sender to specify the html, text optionally, and subject.  To integrate with other tools, the framework also has the ability to send an email as a set of templates, based off a single key. The module will look for:
${d.List(
  d`${d.Input('resources/<key>.compiled.html')}`,
  d`${d.Input('resources/<key>.compiled.text')}`,
  d`${d.Input('resources/<key>.compiled.subject')}`
)}
With ${d.Input('.html')} being the only required field.  The ${mod.EmailTemplate} module supports this format, and will generate files accordingly. Also, note that ${d.Input('<key>')} can include slashes, allowing for nesting folders.

${d.Section('Nodemailer - Extension')}

Given the integration with ${lib.NodeMailer}, all extensions should be usable out of the box. The primary ${lib.NodeMailer} modules are provided (assuming dependencies are installed):

${d.Code(d`sendmail to send all messages via the sendmail operation`, 'doc/sendmail.ts')}

${d.Code(d`smtp to send all messages via the smtp operation`, 'doc/smtp.ts')}

${d.Code(d`ses to send all messages via the ses operation`, 'doc/ses.ts')}
`;
