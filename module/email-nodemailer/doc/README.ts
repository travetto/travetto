import { d, lib } from '@travetto/doc';

export const text = () => d`
${d.Header()}


Given the integration with ${lib.NodeMailer}, all extensions should be usable out of the box. The primary ${lib.NodeMailer} modules are provided (assuming dependencies are installed):

${d.Code(d`sendmail to send all messages via the sendmail operation`, 'src/sendmail.ts')}

${d.Code(d`smtp to send all messages via the smtp operation`, 'src/smtp.ts')}

${d.Code(d`ses to send all messages via the ses operation`, 'src/ses.ts')}
`;