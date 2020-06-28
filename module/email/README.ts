import { d, Library, SnippetLink, Code, inp, Section } from '@travetto/doc';
import { NullTransport } from './src/transport';
import { MailConfig } from './src/config';

const NodeMailer = Library(`nodemailer`, 'https://nodemailer.com/about/');

export default d`

A standard API for sending and rendering emails. The mail transport must be defined to allow for mail to be sent properly.  Out of the box, the only transport available by default is the ${NullTransport} which will just drop emails. The structure of the API is derived from  ${NodeMailer}, but is compatible with any library that can handle the ${SnippetLink('MessageOptions', 'src/types.ts', /interface MessageOptions/)} input.

To expose the necessary email transport, the following pattern is commonly used:

${Code('Declaring the null transport for development', 'alt/docs/src/null.ts')}

Given the amorphous nature of transports, the ${inp`transport`} field in ${MailConfig} is open for any configuration that you may want there. Additionally, the templating engine is optional.  The code will only fail if you attempt to send a templated email without declaring the dependency first.

${Section('Nodmailer - Extension')}

Due to the connection with ${NodeMailer}, all extensions should be usable out of the box. The primary ${NodeMailer} modules are provided (assuming dependencies are installed):

${Code(`${inp`sendmail`} to send all messages via the sendmail operation`, 'alt/docs/src/sendmail.ts')}

${Code(`${inp`smtp`} to send all messages via the smtp operation`, 'alt/docs/src/smtp.ts')}

${Code(`${inp`ses`} to send all messages via the ses operation`, 'alt/docs/src/ses.ts')}
`;
