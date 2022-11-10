import { EmailTemplateResource, EmailTemplateCompiler } from '@travetto/email-template';

export async function main() {

  const compiler = new EmailTemplateCompiler(
    new EmailTemplateResource()
  );

  const res = await compiler.compile('/welcome.email.html', true);

  console.log(
    res.html
      .replace(/<head.*?<\/head>/msg, '')
      .replace(/\s+style="[^"]+"/g, '')
  );
}